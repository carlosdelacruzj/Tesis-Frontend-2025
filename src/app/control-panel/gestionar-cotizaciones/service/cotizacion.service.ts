import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Cotizacion, CotizacionItemPayload, CotizacionPayload, CotizacionContacto, CotizacionContactoPayload, CotizacionContextoPayload, CotizacionDetallePayload, CotizacionEventoPayload, CotizacionApiContacto, CotizacionApiResponse, ClienteBusquedaResultado, CotizacionPublicPayload, CotizacionPublicResponse, CotizacionPublicResult, LeadConvertPayload, CotizacionPedidoPayload, CotizacionPedidoResponse, CotizacionAdminCreatePayload, CotizacionAdminUpdatePayload } from '../model/cotizacion.model';
import { PedidoService } from '../../gestionar-pedido/service/pedido.service';
import { VisualizarService } from '../../gestionar-pedido/service/visualizar.service';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CotizacionService {
  private readonly apiBase: string =
    (typeof environment.baseUrl === 'string' && /^https?:\/\//i.test(environment.baseUrl))
      ? environment.baseUrl
      : `${window.location.protocol}//${window.location.hostname}:3000${environment.baseUrl || '/api/v1'}`;

  private readonly baseUrl = `${this.apiBase}/cotizaciones`;
  private sequence = 0;

  private cotizaciones: Array<Cotizacion & { raw?: CotizacionPayload }> = [];

  constructor(
    private readonly http: HttpClient,
    private readonly pedidoService: PedidoService,
    private readonly visualizarService: VisualizarService
  ) { }

  // [1] GET /cotizaciones
  listCotizaciones(filters?: Record<string, string | number | null | undefined>): Observable<Cotizacion[]> {
    return this.http.get<CotizacionApiResponse[]>(this.baseUrl).pipe(
      map(items => items.map(item => this.normalizeApiCotizacion({
        ...item,
        id: item?.id ?? item?.cotizacion?.idCotizacion ?? undefined
      }))),
      tap(list => {
        if (list.length) {
          const maxId = Math.max(...list.map(item => item.id));
          this.sequence = Math.max(this.sequence, maxId);
        }
        this.cotizaciones = list.map(item => this.cloneCotizacion(item));
      }),
      map(list => this.applyFilters(list, filters)),
      map(list => list.map(item => this.cloneCotizacion(item))),
      catchError(err => throwError(() => err))
    );
  }

  // [2] GET /cotizaciones/:id
  getCotizacion(id: number | string): Observable<Cotizacion> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return throwError(() => new Error('Identificador de cotización inválido'));
    }

    return this.http.get<CotizacionApiResponse>(`${this.baseUrl}/${numericId}`).pipe(
      map(item => this.normalizeApiCotizacion({ ...item, id: item?.id ?? numericId })),
      tap(cotizacion => this.upsertCotizacion(cotizacion)),
      map(cotizacion => this.cloneCotizacion(cotizacion)),
      catchError(err => {
        const cached = this.cotizaciones.find(c => c.id === numericId);
        if (cached) {
          console.warn('[cotizacion] getCotizacion usando cache por error remoto', err);
          return of(this.cloneCotizacion(cached));
        }
        return throwError(() => err);
      })
    );
  }

  // [3] POST /cotizaciones/public
  createCotizacionPublic(payload: CotizacionPublicPayload): Observable<CotizacionPublicResult> {
    const outbound = this.toPublicBackendPayload(payload);

    return this.http.post<CotizacionPublicResponse>(`${this.baseUrl}/public`, outbound).pipe(
      map(response => {
        const fallback = response as Record<string, unknown>;
        return {
          leadId: this.parseNumberNullable(response?.lead_id) ?? this.parseNumberNullable(fallback['leadId']) ?? null,
          cotizacionId: this.parseNumberNullable(response?.cotizacion_id) ?? this.parseNumberNullable(fallback['cotizacionId']) ?? null
        };
      }),
      catchError(err => {
        console.error('[cotizacion] createPublic', err);
        return throwError(() => err);
      })
    );
  }

  buscarClientes(query: string, limit = 15): Observable<ClienteBusquedaResultado[]> {
    const trimmed = (query ?? '').toString().trim();
    if (!trimmed) return of([]);

    // Enviar ambas variantes por compatibilidad con tu backend
    let params = new HttpParams()
      .set('query', trimmed)
      .set('q', trimmed)
      .set('limit', String(limit))
      .set('top', String(limit));

    return this.http
      .get<Array<Record<string, unknown>>>(`${environment.baseUrl}/clientes/buscar`, { params })
      .pipe(
        map(items => Array.isArray(items) ? items.map(item => this.normalizeClienteBusqueda(item)) : []),
        catchError(err => {
          console.error('[cotizacion] buscarClientes', err);
          return throwError(() => err);
        })
      );
  }


  createCotizacion(payload: CotizacionAdminCreatePayload): Observable<Cotizacion> {
    return this.http.post<CotizacionApiResponse>(`${this.baseUrl}/admin`, payload).pipe(
      map(item => this.normalizeApiCotizacion(item)),
      tap(cotizacion => this.upsertCotizacion(cotizacion, true)),
      map(cotizacion => this.cloneCotizacion(cotizacion)),
      catchError(err => {
        console.error('[cotizacion] create', err);
        return throwError(() => err);
      })
    );
  }

  updateCotizacion(id: number | string, payload: CotizacionAdminUpdatePayload): Observable<Cotizacion> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return throwError(() => new Error('Identificador de cotización inválido'));
    }

    return this.http.put<CotizacionApiResponse>(`${this.baseUrl}/${numericId}`, payload).pipe(
      map(item => this.normalizeApiCotizacion({ ...item, id: item?.id ?? numericId })),
      tap(cotizacion => this.upsertCotizacion(cotizacion)),
      map(cotizacion => this.cloneCotizacion(cotizacion)),
      catchError(err => {
        console.error('[cotizacion] update', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Descarga el PDF con payload (logoBase64, firmaBase64, videoEquipo).
   * 1) Intenta POST /api/v1/cotizaciones/:id/pdf (oficial).
   * 2) Si responde 404, reintenta POST /api/cotizacion/:id/pdf (alias).
   */
downloadPdf(
  id: number | string,
  payload: {
    company?: { logoBase64?: string; firmaBase64?: string };
    videoEquipo?: string;
  } = {}
): Observable<Blob> {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return throwError(() => new Error('Identificador de cotización inválido'));
  }

  const urlV1 = `${this.baseUrl}/${numericId}/pdf`;

  // Construye alias en el MISMO origen (:3000) por si /api/v1 no tuviera el espejo
  const aliasBase = this.apiBase.includes('/api/v1')
    ? this.apiBase.replace('/api/v1', '/api')
    : this.apiBase;
  const urlAlias = `${aliasBase}/cotizacion/${numericId}/pdf`;

  return this.http.post(urlV1, payload, { responseType: 'blob' as const }).pipe(
    catchError(err => {
      if (err?.status === 404) {
        return this.http.post(urlAlias, payload, { responseType: 'blob' as const });
      }
      return throwError(() => err);
    })
  );
}

  createPedidoDesdeCotizacion(
    id: number | string,
    payload: CotizacionPedidoPayload
  ): Observable<CotizacionPedidoResponse> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return throwError(() => new Error('Identificador de cotización inválido'));
    }

    const empleadoId = this.parseNumberNullable(payload?.empleadoId);
    if (empleadoId == null) {
      return throwError(() => new Error('El empleado asignado es obligatorio.'));
    }

    const body = this.cleanObject({
      empleadoId,
      nombrePedido: this.toOptionalString(payload?.nombrePedido)
    });

    return this.http
      .post<CotizacionPedidoResponse | Record<string, unknown>>(
        `${this.baseUrl}/${numericId}/pedido`,
        body
      )
      .pipe(
        map(response => {
          const parsedId =
            this.parseNumberNullable((response as CotizacionPedidoResponse)?.pedidoId) ??
            this.parseNumberNullable((response as Record<string, unknown>)?.['id']);

          if (parsedId == null) {
            throw new Error('Respuesta inválida al crear el pedido de la cotización.');
          }

          return { pedidoId: parsedId };
        }),
        catchError(err => {
          console.error('[cotizacion] createPedidoDesdeCotizacion', err);
          return throwError(() => err);
        })
      );
  }

  updateEstado(id: number | string, estadoNuevo: 'Enviada' | 'Aceptada' | 'Rechazada', estadoEsperado: string | null | undefined): Observable<Cotizacion> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return throwError(() => new Error('Identificador de cotización inválido'));
    }

    const payload = {
      estadoNuevo,
      estadoEsperado: estadoEsperado ?? null
    };

    return this.http.put<{ detalle: CotizacionApiResponse | CotizacionApiResponse[] | null } & CotizacionApiResponse>(`${this.baseUrl}/${numericId}/estado`, payload).pipe(
      map(response => {
        const detalle = Array.isArray(response?.detalle)
          ? response.detalle.find(item => Number(item?.id ?? item?.idCotizacion) === numericId)
          : response?.detalle;

        const merged = this.normalizeApiCotizacion({
          ...response,
          ...detalle,
          id: detalle?.id ?? detalle?.idCotizacion ?? response?.id ?? numericId
        });
        return merged;
      }),
      tap(cotizacion => this.upsertCotizacion(cotizacion)),
      map(cotizacion => this.cloneCotizacion(cotizacion)),
      catchError(err => {
        console.error('[cotizacion] updateEstado', err);
        return throwError(() => err);
      })
    );
  }

  convertLeadToCliente(leadId: number | string, payload: LeadConvertPayload): Observable<{ usuarioId?: number | null; clienteId?: number | null; usuarioAccion?: string | null; clienteAccion?: string | null }> {
    const numericId = Number(leadId);
    if (!Number.isFinite(numericId)) {
      return throwError(() => new Error('Identificador de lead inválido'));
    }

    const body = this.cleanObject({
      correo: payload?.correo,
      celular: payload?.celular,
      nombre: payload?.nombre,
      apellido: payload?.apellido,
      numDoc: payload?.numDoc,
      direccion: payload?.direccion
    });

    return this.http.post<{ usuarioId?: number | null; clienteId?: number | null; usuarioAccion?: string | null; clienteAccion?: string | null }>(
      `${this.apiBase}/leads/${numericId}/convertir-a-cliente`,
      body
    ).pipe(
      catchError(err => {
        console.error('[cotizacion] convertLeadToCliente', err);
        return throwError(() => err);
      })
    );
  }

  getServicios(): Observable<any[]> {
    return this.pedidoService.getServicios().pipe(
      catchError(err => {
        console.error('[cotizaciones] getServicios', err);
        return of([]);
      })
    );
  }

  getEventos(): Observable<any[]> {
    return this.pedidoService.getEventos().pipe(
      catchError(err => {
        console.error('[cotizaciones] getEventos', err);
        return of([]);
      })
    );
  }

  getEventosServicio(eventoId?: number | null, servicioId?: number | null): Observable<any[]> {
    return this.visualizarService.getEventosServicio(eventoId ?? undefined, servicioId ?? undefined).pipe(
      catchError(err => {
        console.error('[cotizaciones] getEventosServicio', err);
        return of([]);
      })
    );
  }

  // --------------- helpers internos (no tocados) ---------------

  private normalizeApiCotizacion(api: CotizacionApiResponse): Cotizacion & { raw?: CotizacionPayload } {
    const payload = this.extractPayloadFromApi(api);
    const generatedId = this.sequence + 1;
    const id = (api.id && Number.isFinite(Number(api.id))) ? Number(api.id) : payload.cotizacion.idCotizacion ?? generatedId;

    const codigoApi = this.toOptionalString(
      // Prefer explicit codigo fields coming from the backend.
      (api as any)?.codigo ??
      (api as any)?.codigoCotizacion ??
      (api.cotizacion as any)?.codigo ??
      (api.cotizacion as any)?.codigoCotizacion
    );

    const codigoCache = this.cotizaciones.find(item => item.id === id)?.codigo;
    const normalized = this.buildCotizacion(id, payload, codigoApi ?? codigoCache ?? undefined);

    const estado = api.estado ?? payload.cotizacion.estado;
    if (estado) {
      normalized.estado = estado;
    }
    if (api.mensaje) {
      normalized.notas = api.mensaje;
    }
    if (api.lugar) {
      normalized.lugar = api.lugar;
    }
    if (api.fechaCreacion ?? api.fecha_creacion) {
      normalized.createdAt = api.fechaCreacion ?? api.fecha_creacion ?? normalized.createdAt;
    }
    if (api.cotizacion?.fechaCreacion) {
      normalized.createdAt = api.cotizacion.fechaCreacion;
    }
    const apiContacto = (api.contacto as CotizacionApiContacto | undefined) ?? (api.lead as CotizacionApiContacto | undefined);
    if (apiContacto) {
      const contactoId = this.parseNumberNullable(apiContacto.id ?? apiContacto.idlead ?? apiContacto.ID);
      const contactoBase: Partial<CotizacionContacto> = normalized.contacto ? { ...normalized.contacto } : {};
      const contactoMerged: CotizacionContacto = {
        ...contactoBase,
        id: contactoId ?? contactoBase.id,
        nombre: apiContacto.nombre ?? apiContacto.Nombre ?? contactoBase.nombre,
        celular: apiContacto.celular ?? apiContacto.Celular ?? contactoBase.celular,
        origen: apiContacto.origen ?? apiContacto.Origen ?? contactoBase.origen,
        correo: apiContacto.correo ?? apiContacto.Correo ?? contactoBase.correo,
        fechaCreacion: apiContacto.fechaCreacion ?? apiContacto.fechaCrea ?? contactoBase.fechaCreacion
      };
      normalized.contacto = contactoMerged;
      const resumen = normalized.contactoResumen
        ?? contactoMerged.celular
        ?? contactoMerged.nombre;
      normalized.contactoResumen = resumen ?? normalized.contactoResumen;
    }

    normalized.evento = normalized.evento || normalized.eventoSolicitado || payload.cotizacion.tipoEvento;
    normalized.eventoSolicitado = payload.cotizacion.tipoEvento ?? normalized.eventoSolicitado;

    this.sequence = Math.max(this.sequence, normalized.id);

    return normalized;
  }

  private cloneCotizacion<T extends Cotizacion>(c: T): T {
    return {
      ...c,
      contacto: c.contacto ? { ...c.contacto } : undefined,
      items: Array.isArray(c.items) ? c.items.map(item => ({ ...item })) : undefined,
      raw: this.cloneRaw(c.raw)
    } as T;
  }

  private cloneRaw(raw: unknown): unknown {
    if (Array.isArray(raw)) {
      return raw.map(item => (typeof item === 'object' && item !== null ? { ...(item as Record<string, unknown>) } : item));
    }
    if (typeof raw === 'object' && raw !== null) {
      return { ...(raw as Record<string, unknown>) };
    }
    return raw;
  }

  private upsertCotizacion(cotizacion: Cotizacion & { raw?: CotizacionPayload }, prepend = false): void {
    const clone = this.cloneCotizacion(cotizacion);
    const index = this.cotizaciones.findIndex(item => item.id === clone.id);
    if (index >= 0) {
      this.cotizaciones[index] = clone;
    } else if (prepend) {
      this.cotizaciones = [clone, ...this.cotizaciones];
    } else {
      this.cotizaciones = [...this.cotizaciones, clone];
    }
    this.sequence = Math.max(this.sequence, clone.id);
  }

  private buildCotizacion(id: number, payload: CotizacionPayload, codigo?: string): Cotizacion & { raw?: CotizacionPayload } {
    const normalizedPayload = this.preparePayload(payload, id);
    const detalle = normalizedPayload.cotizacion;
    const contactoPayload = (normalizedPayload.contacto ?? {}) as CotizacionContactoPayload;
    const contexto = normalizedPayload.contexto ?? {};
    const items = Array.isArray(normalizedPayload.items)
      ? normalizedPayload.items.map((item, index) => this.normalizeItem(item, index))
      : [];

    const totalFromItems = items.reduce((acc, item) => acc + (Number(item?.cantidad ?? 0) * Number(item?.precioUnitario ?? 0)), 0);
    const total = detalle.totalEstimado ?? (totalFromItems || undefined) ?? 0;
    const horasTexto = this.formatHoras(detalle.horasEstimadas, contexto.horasEstimadasTexto);

    const clienteDisplay = contactoPayload.nombre
      || (contexto.clienteId != null ? `Cliente #${contexto.clienteId}` : 'Cliente sin nombre');

    const contactoNormalized = this.hasContactoContent(contactoPayload)
      ? ({ ...contactoPayload } as CotizacionContacto)
      : undefined;
    const contactoResumen = contactoPayload.celular ?? contactoPayload.nombre ?? undefined;

    const normalized: Cotizacion & { raw?: CotizacionPayload } = {
      id,
      codigo: codigo ?? `COT-${String(id).padStart(6, '0')}`,
      cliente: clienteDisplay,
      contactoResumen,
      contacto: contactoNormalized,
      servicio: contexto.servicioNombre ?? detalle.tipoEvento,
      evento: contexto.eventoNombre ?? detalle.tipoEvento,
      fecha: detalle.fechaEvento,
      hora: contexto.horaEvento,
      horasEstimadas: horasTexto,
      estado: detalle.estado ?? 'Pendiente',
      total,
      notas: detalle.mensaje,
      pdfUrl: undefined,
      items,
      eventos: normalizedPayload.eventos ?? [],
      raw: {
        ...normalizedPayload,
        cotizacion: {
          ...detalle,
          totalEstimado: total
        }
      },
      lugar: detalle.lugar,
      createdAt: undefined,
      eventoSolicitado: detalle.tipoEvento ?? contexto.eventoNombre,
      servicioId: contexto.servicioId,
      eventoId: detalle.eventoId
    };

    return normalized;
  }

  private preparePayload(payload: CotizacionPayload, id: number): CotizacionPayload {
    const contacto = payload?.contacto ? { ...payload.contacto } : ({} as CotizacionContactoPayload);
    const contexto = payload?.contexto ? { ...payload.contexto } : {};
    const detalleInput: CotizacionDetallePayload = payload?.cotizacion ?? { fechaEvento: new Date().toISOString().slice(0, 10) };
    const fechaEvento = this.formatDateForBackend(detalleInput.fechaEvento) ?? new Date().toISOString().slice(0, 10);
    const horasEstimadas = detalleInput.horasEstimadas ?? this.parseHorasToNumber(contexto.horasEstimadasTexto);
    const totalEstimado = detalleInput.totalEstimado != null ? Number(detalleInput.totalEstimado) : undefined;

    const idTipoEventoParsed = this.parseNumberNullable(detalleInput.idTipoEvento ?? detalleInput.eventoId);

    const detalle = {
      idCotizacion: detalleInput.idCotizacion ?? id,
      eventoId: detalleInput.eventoId ?? undefined,
      idTipoEvento: idTipoEventoParsed ?? undefined,
      tipoEvento: detalleInput.tipoEvento ?? contexto.eventoNombre ?? contexto.servicioNombre ?? contacto.origen ?? undefined,
      fechaEvento,
      lugar: detalleInput.lugar ?? undefined,
      horasEstimadas: horasEstimadas ?? undefined,
      mensaje: detalleInput.mensaje ?? undefined,
      estado: detalleInput.estado ?? undefined,
      totalEstimado: totalEstimado
    };

    const items = Array.isArray(payload?.items) ? payload.items.filter(Boolean) : [];
    const eventos = Array.isArray(payload?.eventos) ? payload.eventos.filter(Boolean) : [];

    const horasTexto = contexto.horasEstimadasTexto ?? this.formatHoras(detalle.horasEstimadas);

    return {
      contacto,
      cotizacion: detalle,
      items,
      eventos,
      contexto: {
        ...contexto,
        horasEstimadasTexto: horasTexto ?? undefined
      }
    };
  }

  private normalizeItem(item: CotizacionItemPayload, index: number): CotizacionItemPayload {
    if (!item) {
      return {
        titulo: `Item ${index + 1}`,
        precioUnitario: 0,
        cantidad: 1
      };
    }

    const cantidad = Number(item.cantidad ?? 1);
    const precio = Number(item.precioUnitario ?? 0);
    const eventoId = this.parseNumberNullable(item.eventoId);
    const servicioId = this.parseNumberNullable(item.servicioId);
    const idEventoServicio = this.parseNumberNullable(item.idEventoServicio);

    return {
      idEventoServicio: idEventoServicio ?? undefined,
      eventoId: eventoId ?? undefined,
      servicioId: servicioId ?? undefined,
      grupo: item.grupo ?? null,
      opcion: item.opcion ?? index + 1,
      titulo: item.titulo ?? item.descripcion ?? `Item ${index + 1}`,
      descripcion: item.descripcion ?? item.titulo,
      moneda: item.moneda ?? 'USD',
      precioUnitario: Number.isFinite(precio) ? precio : 0,
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
      descuento: item.descuento != null ? Number(item.descuento) || 0 : undefined,
      recargo: item.recargo != null ? Number(item.recargo) || 0 : undefined,
      notas: item.notas,
      horas: this.parseNumberNullable(item.horas),
      personal: this.parseNumberNullable(item.personal),
      fotosImpresas: this.parseNumberNullable(item.fotosImpresas),
      trailerMin: this.parseNumberNullable(item.trailerMin),
      filmMin: this.parseNumberNullable(item.filmMin)
    };
  }

  private parseHorasToNumber(value: unknown): number | undefined {
    if (value == null) {
      return undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      const match = trimmed.match(/([\d.,]+)/);
      if (match?.[1]) {
        const parsed = Number(match[1].replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : undefined;
      }
    }
    return undefined;
  }

  private formatHoras(value?: number | null, fallback?: string | undefined): string | undefined {
    if (value != null && Number.isFinite(value)) {
      const num = Number(value);
      return Number.isInteger(num) ? `${num} h` : `${num} h`;
    }
    return fallback ?? undefined;
  }

  private parseNumberNullable(value: unknown): number | null {
    if (value == null || value === '') {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const parsed = Number(trimmed.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value == null) {
      return undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }

  private formatDateForBackend(value?: string | null): string | undefined {
    if (value == null) {
      return undefined;
    }
    const trimmed = String(value).trim();
    if (!trimmed) {
      return undefined;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const normalized = trimmed.replace(' ', 'T');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().slice(0, 10);
    }
    return trimmed;
  }

  private normalizeClienteBusqueda(raw: Record<string, unknown> | null | undefined): ClienteBusquedaResultado {
    if (!raw) return {};

    const idRaw = raw['id'] ?? raw['idCliente'];
    const codigoRaw = raw['codigo'] ?? raw['codigoCliente'];

    const nombre = this.toOptionalString(raw['nombre']);
    const apellido = this.toOptionalString(raw['apellido']);
    const nombreCompleto = this.toOptionalString(raw['nombreCompleto']);
    const razonSocial = this.toOptionalString(raw['razonSocial']);
    const contacto = this.toOptionalString(raw['contacto']);
    const email = this.toOptionalString(raw['email']);
    const correo = this.toOptionalString(raw['correo']);
    const celular = this.toOptionalString(raw['celular']);
    const telefono = this.toOptionalString(raw['telefono']);
    const whatsapp = this.toOptionalString(raw['whatsapp']);
    const direccion = this.toOptionalString(raw['direccion']);
    const identificador = this.toOptionalString(raw['identificador']);
    const doc = this.toOptionalString(raw['doc']);
    const numeroDocumento = this.toOptionalString(raw['numeroDocumento']);
    const ruc = this.toOptionalString(raw['ruc']);

    const nombreCompuesto = [nombre, apellido].filter(Boolean).join(' ').trim();
    const nombreBase = nombreCompleto
      ?? (nombreCompuesto || '')
      ?? razonSocial
      ?? contacto
      ?? email
      ?? correo
      ?? '';

    const contactoBase = contacto
      ?? celular
      ?? telefono
      ?? whatsapp
      ?? email
      ?? correo
      ?? '';

    const identificadorBase = identificador
      ?? doc
      ?? numeroDocumento
      ?? ruc
      ?? '';

    const idParsed = this.parseNumberNullable(idRaw);
    const idValue = idParsed ?? (typeof idRaw === 'string' ? idRaw : undefined);
    const codigoValue = typeof codigoRaw === 'string' ? codigoRaw : undefined;

    return {
      ...(raw as ClienteBusquedaResultado),
      id: idValue ?? undefined,
      codigo: codigoValue ?? undefined,
      nombre: nombre ?? (nombreBase || undefined),
      nombreCompleto: nombreCompleto ?? (nombreBase || undefined),
      correo: correo ?? email ?? undefined,
      email: email ?? correo ?? undefined,
      celular: celular ?? undefined,
      telefono: telefono ?? undefined,
      contacto: contacto ?? (contactoBase || undefined),
      identificador: identificadorBase || undefined,
      direccion: direccion ?? undefined
    };
  }

  private cleanObject(input: Record<string, any>): Record<string, any> {
    const output: Record<string, any> = {};
    Object.entries(input).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        output[key] = value;
      }
    });
    return output;
  }

  private hasContactoContent(contacto?: CotizacionPayload['contacto']): boolean {
    if (!contacto) {
      return false;
    }
    return Boolean(contacto.nombre || contacto.celular || contacto.correo || contacto.origen);
  }

  private toPublicBackendPayload(payload: CotizacionPublicPayload): Record<string, unknown> {
    const contactoInput = payload?.contacto ?? {};
    const cotizacionInput = payload?.cotizacion ?? { fechaEvento: new Date().toISOString().slice(0, 10) };

    const contactoOutbound = this.hasContactoContent(contactoInput)
      ? this.cleanObject({
          nombre: this.toOptionalString(contactoInput.nombre),
          celular: this.toOptionalString(contactoInput.celular),
          origen: this.toOptionalString(contactoInput.origen),
          correo: this.toOptionalString(contactoInput.correo)
        })
      : undefined;

    const fechaEvento = this.formatDateForBackend(cotizacionInput.fechaEvento)
      ?? this.toOptionalString(cotizacionInput.fechaEvento)
      ?? new Date().toISOString().slice(0, 10);

    const cotizacionOutbound = this.cleanObject({
      idTipoEvento: this.parseNumberNullable(cotizacionInput.idTipoEvento) ?? undefined,
      tipoEvento: this.toOptionalString(cotizacionInput.tipoEvento),
      fechaEvento,
      lugar: this.toOptionalString(cotizacionInput.lugar),
      horasEstimadas: cotizacionInput.horasEstimadas != null ? Number(cotizacionInput.horasEstimadas) : undefined,
      mensaje: this.toOptionalString(cotizacionInput.mensaje)
    });

    const outbound: Record<string, unknown> = {
      cotizacion: cotizacionOutbound
    };

    if (contactoOutbound && Object.keys(contactoOutbound).length) {
      outbound.lead = contactoOutbound;
    }

    return outbound;
  }

  private extractPayloadFromApi(api: CotizacionApiResponse): CotizacionPayload {
    const contactoRaw = (api.contacto as CotizacionApiContacto | undefined) ?? (api.lead as CotizacionApiContacto | undefined) ?? {};
    const contactoIdRaw = this.parseNumberNullable(contactoRaw?.id ?? contactoRaw?.idlead ?? contactoRaw?.ID);
    const contacto: CotizacionContactoPayload = {
      id: contactoIdRaw ?? undefined,
      nombre: contactoRaw?.nombre ?? contactoRaw?.Nombre ?? undefined,
      celular: contactoRaw?.celular ?? contactoRaw?.Celular ?? undefined,
      origen: contactoRaw?.origen ?? contactoRaw?.Origen ?? undefined,
      correo: contactoRaw?.correo ?? contactoRaw?.Correo ?? undefined,
      fechaCreacion: contactoRaw?.fechaCreacion ?? contactoRaw?.fechaCrea ?? undefined
    };

    const detalleApi = api.cotizacion ?? null;

    const idCotizacion = this.parseNumberNullable(
      detalleApi?.idCotizacion ?? api.idCotizacion ?? api.id ?? undefined
    );

    const eventoId = this.parseNumberNullable(
      detalleApi?.eventoId ?? detalleApi?.idTipoEvento ?? api.eventoId ?? api.idEvento ?? api.idTipoEvento ?? undefined
    );

    const tipoEvento = detalleApi?.tipoEvento
      ?? api.tipoEvento
      ?? api.evento
      ?? undefined;

    const fechaEventoRaw = detalleApi?.fechaEvento
      ?? api.fechaEvento
      ?? api.fecha_evento
      ?? detalleApi?.fechaCreacion
      ?? api.fechaCreacion
      ?? new Date().toISOString().slice(0, 10);
    const fechaEvento = this.normalizeIsoDate(fechaEventoRaw);

    const horasRaw = detalleApi?.horasEstimadas
      ?? api.horasEstimadas
      ?? api.horas_estimadas
      ?? undefined;
    const horasNumero = typeof horasRaw === 'number'
      ? horasRaw
      : this.parseHorasToNumber(horasRaw);
    const horasTexto = typeof horasRaw === 'string'
      ? horasRaw
      : (horasNumero != null ? `${horasNumero}` : undefined);

    const totalRaw = detalleApi?.totalEstimado
      ?? detalleApi?.total
      ?? api.totalEstimado
      ?? api.total
      ?? undefined;
    const totalNumber = this.parseNumberNullable(totalRaw ?? undefined);

    const detalle: CotizacionDetallePayload = {
      idCotizacion: idCotizacion ?? undefined,
      eventoId: eventoId ?? undefined,
      tipoEvento,
      fechaEvento,
      lugar: detalleApi?.lugar ?? api.lugar ?? undefined,
      horasEstimadas: horasNumero ?? undefined,
      mensaje: detalleApi?.mensaje ?? api.mensaje ?? api.notas ?? undefined,
      estado: detalleApi?.estado ?? api.estado ?? undefined,
      totalEstimado: totalNumber ?? undefined
    };

    const itemsSource = Array.isArray(api.items) && api.items.length
      ? api.items
      : Array.isArray(detalleApi?.items)
        ? detalleApi.items
        : [];
    const items = itemsSource.map((item, index) => this.extractItemFromApi(item, index));

    const clienteId = contactoIdRaw;

    const contexto: CotizacionContextoPayload = {
      clienteId: clienteId ?? undefined,
      servicioId: undefined,
      servicioNombre: tipoEvento ?? undefined,
      eventoNombre: tipoEvento ?? undefined,
      horaEvento: undefined,
      horasEstimadasTexto: horasTexto ?? undefined
    };

    const eventosFuente = Array.isArray(api.eventos) ? api.eventos : [];
    const eventos = eventosFuente
      .map((evento: any, index: number) => this.extractEventoFromApi(evento, index))
      .filter(evento => evento != null);

    return {
      contacto,
      cotizacion: detalle,
      items,
      eventos,
      contexto
    };
  }

  private extractEventoFromApi(raw: Record<string, unknown> | null | undefined, index: number): CotizacionEventoPayload | null {
    if (!raw) {
      return null;
    }

    const nombre = this.toOptionalString(
      raw['ubicacion'] ?? raw['nombre'] ?? raw['locacion'] ?? raw['lugar'] ?? raw['titulo']
    );
    const direccion = this.toOptionalString(
      raw['direccion'] ?? raw['direccionExacta'] ?? raw['address']
    );
    const fecha = this.normalizeProgramacionFecha(
      this.toOptionalString(
        raw['fecha'] ?? raw['fechaEvento'] ?? raw['Fecha'] ?? raw['date']
      )
    );
    const hora = this.normalizeProgramacionHora(
      this.toOptionalString(
        raw['hora'] ?? raw['horaEvento'] ?? raw['Hora'] ?? raw['time']
      )
    );
    const notas = this.toOptionalString(
      raw['notas'] ?? raw['Notas'] ?? raw['comentarios'] ?? raw['observaciones']
    );

    if (!nombre && !direccion && !fecha && !hora && !notas) {
      return null;
    }

    return this.cleanObject({
      id: this.parseNumberNullable(raw['id'] ?? raw['ID'] ?? raw['idEvento']),
      fecha,
      hora,
      ubicacion: nombre ?? undefined,
      direccion: direccion ?? undefined,
      notas: notas ?? undefined,
      esPrincipal: index < 2
    }) as CotizacionEventoPayload;
  }

  private normalizeProgramacionFecha(valor?: string | null): string | undefined {
    if (valor == null) {
      return undefined;
    }
    const raw = String(valor).trim();
    if (!raw) {
      return undefined;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const dash = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dash) {
      return `${dash[3]}-${dash[2]}-${dash[1]}`;
    }
    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
      return `${slash[3]}-${slash[2]}-${slash[1]}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().slice(0, 10);
    }
    return undefined;
  }

  private normalizeProgramacionHora(valor?: string | null): string | undefined {
    if (valor == null) {
      return undefined;
    }
    const raw = String(valor).trim();
    if (!raw) {
      return undefined;
    }
    if (/^\d{2}:\d{2}$/.test(raw)) {
      return raw;
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
      return raw.slice(0, 5);
    }
    const match = raw.match(/(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    return undefined;
  }

  private extractItemFromApi(item: Record<string, unknown>, index: number): CotizacionItemPayload {
    const precio = this.parseNumberNullable(
      item['precioUnitario'] ?? item['precioUnit'] ?? item['precio'] ?? item['subtotal']
    ) ?? 0;
    const cantidad = this.parseNumberNullable(item['cantidad']) ?? 1;
    const horas = this.parseNumberNullable(item['horas']);
    const personal = this.parseNumberNullable(item['personal']);
    const fotosImpresas = this.parseNumberNullable(item['fotosImpresas']);
    const trailerMin = this.parseNumberNullable(item['trailerMin']);
    const filmMin = this.parseNumberNullable(item['filmMin']);
    const descuento = this.parseNumberNullable(item['descuento']);
    const recargo = this.parseNumberNullable(item['recargo']);
    const opcion = this.parseNumberNullable(item['opcion']);
    const idEventoServicio = this.parseNumberNullable(
      item['idEventoServicio'] ?? item['eventoServicioId'] ?? item['idCotizacionServicio']
    );
    const eventoId = this.parseNumberNullable(
      item['eventoId'] ?? item['idEvento'] ?? item['evento_id']
    );
    const servicioId = this.parseNumberNullable(
      item['servicioId'] ?? item['idServicio'] ?? item['servicio_id']
    );

    const titulo = this.toOptionalString(item['titulo'])
      ?? this.toOptionalString(item['nombre'])
      ?? this.toOptionalString(item['descripcion'])
      ?? `Item ${index + 1}`;
    const descripcion = this.toOptionalString(item['descripcion'])
      ?? this.toOptionalString(item['nombre'])
      ?? this.toOptionalString(item['titulo'])
      ?? undefined;
    const monedaRaw = this.toOptionalString(item['moneda'])
      ?? this.toOptionalString(item['currency'])
      ?? this.toOptionalString(item['Moneda']);

    return {
      idEventoServicio: idEventoServicio != null ? idEventoServicio : undefined,
      grupo: this.toOptionalString(item['grupo']) ?? this.toOptionalString(item['Grupo']) ?? null,
      opcion: opcion != null ? opcion : null,
      titulo,
      descripcion,
      moneda: monedaRaw ? monedaRaw.toUpperCase() : undefined,
      precioUnitario: Number.isFinite(precio) ? precio : 0,
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
      descuento: descuento != null ? descuento : undefined,
      recargo: recargo != null ? recargo : undefined,
      notas: this.toOptionalString(item['notas']),
      horas,
      personal,
      fotosImpresas,
      trailerMin,
      filmMin,
      eventoId: eventoId ?? undefined,
      servicioId: servicioId ?? undefined
    };
  }

  private normalizeIsoDate(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'string') {
      const formatted = this.formatDateForBackend(value);
      if (formatted) {
        return formatted;
      }
      const trimmed = value.trim();
      if (trimmed) {
        const direct = new Date(trimmed);
        if (!Number.isNaN(direct.valueOf())) {
          return direct.toISOString().slice(0, 10);
        }
        const normalized = trimmed.replace(' ', 'T');
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.valueOf())) {
          return parsed.toISOString().slice(0, 10);
        }
      }
    }
    return new Date().toISOString().slice(0, 10);
  }

  private applyFilters(data: Array<Cotizacion & { raw?: CotizacionPayload }>, filters?: Record<string, string | number | null | undefined>): Cotizacion[] {
    if (!filters) {
      return data.map(c => this.cloneCotizacion(c));
    }
    const entries = Object.entries(filters).filter(([_, value]) => value !== null && value !== undefined && value !== '');
    if (!entries.length) {
      return data.map(c => this.cloneCotizacion(c));
    }
    return data
      .filter(cot => entries.every(([key, value]) => {
        const raw = cot.raw as CotizacionPayload | undefined;
        const serialized = `${JSON.stringify({
          id: cot.id,
          codigo: cot.codigo,
          cliente: cot.cliente,
          contacto: cot.contactoResumen ?? cot.contacto?.celular ?? cot.contacto?.nombre,
          servicio: cot.servicio,
          evento: cot.evento,
          fecha: cot.fecha,
          estado: cot.estado,
          total: cot.total,
          notas: cot.notas,
          lugar: cot.lugar
        })}${raw ? JSON.stringify(raw) : ''}`.toLowerCase();
        const directValue = String(((cot as unknown) as Record<string, unknown>)[key] ?? '').toLowerCase();
        const candidate = `${directValue} ${serialized}`;
        return candidate.includes(String(value).toLowerCase());
      }))
      .map(c => this.cloneCotizacion(c));
  }
}
