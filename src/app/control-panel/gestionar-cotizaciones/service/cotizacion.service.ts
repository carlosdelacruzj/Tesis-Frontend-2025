import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, delay, map, tap } from 'rxjs/operators';

import {
  Cotizacion,
  CotizacionItemPayload,
  CotizacionPayload,
  CotizacionUpdatePayload,
  CotizacionLead,
  CotizacionContextoPayload,
  CotizacionDetallePayload
} from '../model/cotizacion.model';
import { PedidoService } from '../../gestionar-pedido/service/pedido.service';
import { VisualizarService } from '../../gestionar-pedido/service/visualizar.service';
import { environment } from '../../../../environments/environment';

interface CotizacionApiResponse {
  id?: number | string | null;
  idCotizacion?: number | string | null;
  estado?: string | null;
  fechaCreacion?: string | null;
  fecha_creacion?: string | null;
  eventoId?: number | string | null;
  idEvento?: number | string | null;
  idTipoEvento?: number | string | null;
  tipoEvento?: string | null;
  evento?: string | null;
  fechaEvento?: string | null;
  fecha_evento?: string | null;
  lugar?: string | null;
  horasEstimadas?: string | number | null;
  horas_estimadas?: string | number | null;
  mensaje?: string | null;
  notas?: string | null;
  total?: number | string | null;
  totalEstimado?: number | string | null;
  lead?: Record<string, any> | null;
  cotizacion?: (Partial<CotizacionDetallePayload> & {
    horasEstimadas?: number | string | null;
    totalEstimado?: number | string | null;
    total?: number | string | null;
    fechaEvento?: string | null;
    fechaCreacion?: string | null;
    estado?: string | null;
    idTipoEvento?: number | string | null;
  }) | null;
  items?: Array<Record<string, any>> | null;
}

export interface ClienteBusquedaResultado {
  [key: string]: any;
  id?: number | string | null;
  nombre?: string | null;
  nombreCompleto?: string | null;
  razonSocial?: string | null;
  documento?: string | null;
  numeroDocumento?: string | null;
  tipoDocumento?: string | null;
  ruc?: string | null;
  correo?: string | null;
  email?: string | null;
  telefono?: string | null;
  celular?: string | null;
  whatsapp?: string | null;
  contacto?: string | null;
  identificador?: string | null;
  direccion?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CotizacionService {
  private readonly latency = 250;
  private readonly baseUrl = `${environment.baseUrl}/cotizaciones`;
  private sequence = 0;

  private cotizaciones: Array<Cotizacion & { raw?: CotizacionPayload }> = [];

  constructor(
    private readonly http: HttpClient,
    private readonly pedidoService: PedidoService,
    private readonly visualizarService: VisualizarService
  ) {}

  listCotizaciones(filters?: Record<string, string | number | null | undefined>): Observable<Cotizacion[]> {
    return this.http.get<CotizacionApiResponse[]>(this.baseUrl).pipe(
      map(items => items.map(item => this.normalizeApiCotizacion({
        ...item,
        id: item?.id ?? (item?.cotizacion as any)?.idCotizacion ?? undefined
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

  getCotizacion(id: number | string): Observable<Cotizacion> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return throwError(() => new Error('Identificador de cotizaciÃ³n invÃ¡lido'));
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

  buscarClientes(query: string, limit = 10): Observable<ClienteBusquedaResultado[]> {
    const trimmed = (query ?? '').toString().trim();
    if (!trimmed) {
      return of([]);
    }

    const params = new HttpParams()
      .set('query', trimmed)
      .set('limit', String(limit));

    return this.http.get<ClienteBusquedaResultado[]>(`${environment.baseUrl}/clientes/buscar`, { params }).pipe(
      map(items => Array.isArray(items) ? items.map(item => this.normalizeClienteBusqueda(item)) : []),
      catchError(err => {
        console.error('[cotizacion] buscarClientes', err);
        return throwError(() => err);
      })
    );
  }

  createCotizacion(payload: CotizacionPayload): Observable<Cotizacion> {
    const outbound = this.toBackendPayload(payload);
    return this.http.post<CotizacionApiResponse>(`${this.baseUrl}/admin`, outbound).pipe(
      map(item => this.normalizeApiCotizacion(item)),
      tap(cotizacion => this.upsertCotizacion(cotizacion, true)),
      map(cotizacion => this.cloneCotizacion(cotizacion)),
      catchError(err => {
        console.error('[cotizacion] create', err);
        return throwError(() => err);
      })
    );
  }

  updateCotizacion(id: number | string, payload: CotizacionUpdatePayload): Observable<Cotizacion> {
    const numericId = Number(id);
    const index = this.cotizaciones.findIndex(cot => cot.id === numericId);
    if (index === -1) {
      return throwError(() => new Error('CotizaciÃ³n no encontrada'));
    }

    const base = this.cotizaciones[index];
    const basePayload = (base.raw as CotizacionPayload | undefined) ?? this.buildFallbackPayloadFromCotizacion(base);
    const mergedPayload = this.mergePayload(basePayload, payload);
    const outbound = this.toBackendPayload(mergedPayload, { includeLead: false });

    return this.http.put<CotizacionApiResponse>(`${this.baseUrl}/${numericId}`, outbound).pipe(
      map(item => this.normalizeApiCotizacion({ ...item, id: item?.id ?? numericId })),
      tap(cotizacion => this.upsertCotizacion(cotizacion)),
      map(cotizacion => this.cloneCotizacion(cotizacion)),
      catchError(err => {
        console.error('[cotizacion] update', err);
        return throwError(() => err);
      })
    );
  }

  downloadPdf(id: number | string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' }).pipe(
      catchError(err => {
        console.error('[cotizacion] downloadPdf', err);
        return throwError(() => err);
      })
    );
  }

  updateEstado(id: number | string, estadoNuevo: 'Enviada' | 'Aceptada' | 'Rechazada', estadoEsperado: string | null | undefined): Observable<Cotizacion> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return throwError(() => new Error('Identificador de cotizaciÃ³n invÃ¡lido'));
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

  private normalizeApiCotizacion(api: CotizacionApiResponse): Cotizacion & { raw?: CotizacionPayload } {
    const payload = this.extractPayloadFromApi(api);
    const generatedId = this.sequence + 1;
    const id = (api.id && Number.isFinite(Number(api.id))) ? Number(api.id) : payload.cotizacion.idCotizacion ?? generatedId;

    const normalized = this.buildCotizacion(id, payload);

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
    if ((api.cotizacion as any)?.fechaCreacion) {
      normalized.createdAt = (api.cotizacion as any).fechaCreacion;
    }
    if (api.lead) {
      const leadId = this.parseNumberNullable(api.lead.id ?? api.lead.idlead ?? api.lead.ID);
      normalized.lead = {
        ...normalized.lead,
        id: leadId ?? normalized.lead?.id,
        nombre: api.lead.nombre ?? api.lead.Nombre ?? normalized.lead?.nombre,
        celular: api.lead.celular ?? api.lead.Celular ?? normalized.lead?.celular,
        origen: api.lead.origen ?? api.lead.Origen ?? normalized.lead?.origen,
        correo: api.lead.correo ?? api.lead.Correo ?? normalized.lead?.correo,
        fechaCreacion: api.lead.fechaCreacion ?? api.lead.fechaCrea ?? normalized.lead?.fechaCreacion
      } as CotizacionLead;
    }

    normalized.evento = normalized.evento || normalized.eventoSolicitado || payload.cotizacion.tipoEvento;
    normalized.eventoSolicitado = payload.cotizacion.tipoEvento ?? normalized.eventoSolicitado;

    this.sequence = Math.max(this.sequence, normalized.id);

    return normalized;
  }

  private cloneCotizacion<T extends Cotizacion>(c: T): T {
    return {
      ...c,
      lead: c.lead ? { ...c.lead } : undefined,
      items: Array.isArray(c.items) ? c.items.map(item => ({ ...item })) : undefined,
      raw: c.raw ? { ...(c.raw as any) } : undefined
    } as T;
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
    const lead = normalizedPayload.lead ?? {};
    const contexto = normalizedPayload.contexto ?? {};
    const items = Array.isArray(normalizedPayload.items)
      ? normalizedPayload.items.map((item, index) => this.normalizeItem(item, index))
      : [];

    const totalFromItems = items.reduce((acc, item) => acc + (Number(item?.cantidad ?? 0) * Number(item?.precioUnitario ?? 0)), 0);
    const total = detalle.totalEstimado ?? (totalFromItems || undefined) ?? 0;
    const horasTexto = this.formatHoras(detalle.horasEstimadas, contexto.horasEstimadasTexto);

    const clienteDisplay = lead.nombre
      || (contexto.clienteId != null ? `Cliente #${contexto.clienteId}` : 'Cliente sin nombre');

    const leadNormalized = this.hasLeadContent(lead) ? { ...lead } : undefined;

    const normalized: Cotizacion & { raw?: CotizacionPayload } = {
      id,
      codigo: codigo ?? `COT-${String(id).padStart(3, '0')}`,
      cliente: clienteDisplay,
      contacto: lead.celular,
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
      raw: {
        ...normalizedPayload,
        cotizacion: {
          ...detalle,
          totalEstimado: total
        }
      },
      lugar: detalle.lugar,
      createdAt: undefined,
      lead: leadNormalized,
      eventoSolicitado: detalle.tipoEvento ?? contexto.eventoNombre,
      servicioId: contexto.servicioId,
      eventoId: detalle.eventoId
    };

    return normalized;
  }

  private preparePayload(payload: CotizacionPayload, id: number): CotizacionPayload {
    const lead = payload?.lead ? { ...payload.lead } : {};
    const contexto = payload?.contexto ? { ...payload.contexto } : {};
    const detalleInput = payload?.cotizacion ?? { fechaEvento: new Date().toISOString() };
    const fechaEvento = detalleInput.fechaEvento ?? new Date().toISOString();
    const horasEstimadas = detalleInput.horasEstimadas ?? this.parseHorasToNumber(contexto.horasEstimadasTexto);
    const totalEstimado = detalleInput.totalEstimado != null ? Number(detalleInput.totalEstimado) : undefined;

    const idTipoEventoParsed = this.parseNumberNullable((detalleInput as any)?.idTipoEvento ?? detalleInput.eventoId);

    const detalle = {
      idCotizacion: detalleInput.idCotizacion ?? id,
      eventoId: detalleInput.eventoId ?? undefined,
      idTipoEvento: idTipoEventoParsed ?? undefined,
      tipoEvento: detalleInput.tipoEvento ?? contexto.eventoNombre ?? contexto.servicioNombre ?? lead.origen ?? undefined,
      fechaEvento,
      lugar: detalleInput.lugar ?? undefined,
      horasEstimadas: horasEstimadas ?? undefined,
      mensaje: detalleInput.mensaje ?? undefined,
      estado: detalleInput.estado ?? undefined,
      totalEstimado: totalEstimado
    };

    const items = Array.isArray(payload?.items) ? payload.items.filter(Boolean) : [];

    const horasTexto = contexto.horasEstimadasTexto ?? this.formatHoras(detalle.horasEstimadas);

    return {
      lead,
      cotizacion: detalle,
      items,
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

    return {
      idEventoServicio: item.idEventoServicio ?? item.idEventoServicio,
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

  private mergePayload(base: CotizacionPayload, updates: CotizacionUpdatePayload): CotizacionPayload {
    if (!updates) {
      return this.preparePayload(base, base?.cotizacion?.idCotizacion ?? 0);
    }

    const merged: CotizacionPayload = {
      lead: { ...base?.lead, ...updates?.lead },
      cotizacion: { ...base?.cotizacion, ...updates?.cotizacion },
      items: Array.isArray(updates?.items) ? updates.items : base?.items ?? [],
      contexto: { ...base?.contexto, ...updates?.contexto }
    };

    return this.preparePayload(merged, merged.cotizacion?.idCotizacion ?? 0);
  }

  private buildFallbackPayloadFromCotizacion(cotizacion: Cotizacion): CotizacionPayload {
    const lead: CotizacionPayload['lead'] = {
      nombre: cotizacion.lead?.nombre ?? cotizacion.cliente,
      celular: cotizacion.lead?.celular ?? cotizacion.contacto ?? undefined,
      origen: cotizacion.lead?.origen,
      correo: cotizacion.lead?.correo
    };

    const detalle: CotizacionPayload['cotizacion'] = {
      idCotizacion: cotizacion.id,
      eventoId: cotizacion.eventoId,
      idTipoEvento: cotizacion.eventoId,
      tipoEvento: cotizacion.evento ?? cotizacion.eventoSolicitado ?? cotizacion.servicio,
      fechaEvento: cotizacion.fecha ?? new Date().toISOString(),
      lugar: cotizacion.lugar,
      horasEstimadas: this.parseHorasToNumber(cotizacion.horasEstimadas),
      mensaje: cotizacion.notas,
      estado: cotizacion.estado,
      totalEstimado: cotizacion.total ?? undefined
    };

    const contexto: CotizacionPayload['contexto'] = {
      clienteId: undefined,
      servicioId: cotizacion.servicioId,
      servicioNombre: cotizacion.servicio,
      eventoNombre: cotizacion.evento,
      horaEvento: cotizacion.hora,
      horasEstimadasTexto: cotizacion.horasEstimadas
    };

    return {
      lead,
      cotizacion: detalle,
      items: Array.isArray(cotizacion.items) ? cotizacion.items.map((item, index) => this.normalizeItem(item, index)) : [],
      contexto
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

  private normalizeClienteBusqueda(item: ClienteBusquedaResultado): ClienteBusquedaResultado {
    if (!item) {
      return {};
    }
    const nombreBase = item.nombreCompleto
      ?? item.nombre
      ?? item.razonSocial
      ?? item.contacto
      ?? item.email
      ?? item.correo
      ?? '';
    const contactoBase = item.contacto
      ?? item.celular
      ?? item.telefono
      ?? item.whatsapp
      ?? item.email
      ?? item.correo
      ?? '';
    const identificadorBase = item.identificador
      ?? item.documento
      ?? item.numeroDocumento
      ?? item.ruc
      ?? '';
    return {
      ...item,
      nombre: item.nombre ?? (nombreBase || undefined),
      nombreCompleto: item.nombreCompleto ?? (nombreBase || undefined),
      contacto: item.contacto ?? (contactoBase || undefined),
      identificador: item.identificador ?? (identificadorBase || undefined)
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

  private hasLeadContent(lead?: CotizacionPayload['lead']): boolean {
    if (!lead) {
      return false;
    }
    return Boolean(lead.nombre || lead.celular || lead.correo || lead.origen);
  }

  private toBackendPayload(payload: CotizacionPayload, options: { includeLead?: boolean } = {}): Record<string, any> {
    const includeLead = options.includeLead ?? true;
    const normalized = this.preparePayload(payload, payload?.cotizacion?.idCotizacion ?? 0);
    const detalle = (normalized.cotizacion ?? {}) as CotizacionDetallePayload;

    const cotizacionOutbound = this.cleanObject({
      idCotizacion: detalle.idCotizacion,
      eventoId: detalle.eventoId,
      idTipoEvento: detalle.idTipoEvento ?? detalle.eventoId,
      tipoEvento: detalle.tipoEvento,
      fechaEvento: this.formatDateForBackend(detalle.fechaEvento),
      lugar: detalle.lugar,
      horasEstimadas: detalle.horasEstimadas,
      mensaje: detalle.mensaje,
      estado: detalle.estado,
      totalEstimado: detalle.totalEstimado
    });

    const itemsOutbound = (normalized.items ?? []).map(item => this.cleanObject({
      idEventoServicio: item.idEventoServicio,
      grupo: item.grupo ?? undefined,
      opcion: item.opcion ?? undefined,
      titulo: item.titulo,
      descripcion: item.descripcion,
      moneda: item.moneda,
      precioUnitario: item.precioUnitario,
      cantidad: item.cantidad,
      descuento: item.descuento,
      recargo: item.recargo,
      notas: item.notas,
      horas: item.horas,
      personal: item.personal,
      fotosImpresas: item.fotosImpresas,
      trailerMin: item.trailerMin,
      filmMin: item.filmMin
    }));

    const outbound: Record<string, any> = {
      cotizacion: cotizacionOutbound,
      items: itemsOutbound
    };

    if (includeLead && this.hasLeadContent(normalized.lead)) {
      outbound.lead = this.cleanObject({
        id: normalized.lead?.id,
        nombre: normalized.lead?.nombre,
        celular: normalized.lead?.celular,
        origen: normalized.lead?.origen,
        correo: normalized.lead?.correo
      });
    }

    return outbound;
  }

  private extractPayloadFromApi(api: CotizacionApiResponse): CotizacionPayload {
    const leadRaw = api.lead ?? {};
    const lead = {
      nombre: leadRaw?.nombre ?? leadRaw?.Nombre ?? undefined,
      celular: leadRaw?.celular ?? leadRaw?.Celular ?? undefined,
      origen: leadRaw?.origen ?? leadRaw?.Origen ?? undefined,
      correo: leadRaw?.correo ?? leadRaw?.Correo ?? undefined
    };

    const detalleApi = api.cotizacion ?? {};

    const idCotizacion = this.parseNumberNullable(
      detalleApi.idCotizacion ?? api.idCotizacion ?? api.id ?? undefined
    );

    const eventoId = this.parseNumberNullable(
      detalleApi.eventoId ?? detalleApi.idTipoEvento ?? api.eventoId ?? api.idEvento ?? api.idTipoEvento ?? undefined
    );

    const tipoEvento = detalleApi.tipoEvento
      ?? api.tipoEvento
      ?? api.evento
      ?? undefined;

    const fechaEventoRaw = detalleApi.fechaEvento
      ?? api.fechaEvento
      ?? api.fecha_evento
      ?? detalleApi.fechaCreacion
      ?? api.fechaCreacion
      ?? new Date().toISOString();
    const fechaEvento = this.normalizeIsoDate(fechaEventoRaw);

    const horasRaw = detalleApi.horasEstimadas
      ?? api.horasEstimadas
      ?? api.horas_estimadas
      ?? undefined;
    const horasNumero = typeof horasRaw === 'number'
      ? horasRaw
      : this.parseHorasToNumber(horasRaw);
    const horasTexto = typeof horasRaw === 'string'
      ? horasRaw
      : (horasNumero != null ? `${horasNumero}` : undefined);

    const totalRaw = detalleApi.totalEstimado
      ?? detalleApi.total
      ?? api.totalEstimado
      ?? api.total
      ?? undefined;
    const totalNumber = this.parseNumberNullable(totalRaw ?? undefined);

    const detalle: CotizacionDetallePayload = {
      idCotizacion: idCotizacion ?? undefined,
      eventoId: eventoId ?? undefined,
      tipoEvento,
      fechaEvento,
      lugar: detalleApi.lugar ?? api.lugar ?? undefined,
      horasEstimadas: horasNumero ?? undefined,
      mensaje: detalleApi.mensaje ?? api.mensaje ?? api.notas ?? undefined,
      estado: detalleApi.estado ?? api.estado ?? undefined,
      totalEstimado: totalNumber ?? undefined
    };

    const itemsSource = Array.isArray(api.items) && api.items.length
      ? api.items
      : (Array.isArray((detalleApi as any)?.items) ? (detalleApi as any).items : []);
    const items = itemsSource.map((item, index) => this.extractItemFromApi(item, index));

    const clienteId = this.parseNumberNullable(leadRaw?.id ?? leadRaw?.idlead ?? leadRaw?.ID);

    const contexto: CotizacionContextoPayload = {
      clienteId: clienteId ?? undefined,
      servicioId: undefined,
      servicioNombre: tipoEvento ?? undefined,
      eventoNombre: tipoEvento ?? undefined,
      horaEvento: undefined,
      horasEstimadasTexto: horasTexto ?? undefined
    };

    return {
      lead,
      cotizacion: detalle,
      items,
      contexto
    };
  }

  private extractItemFromApi(item: Record<string, any>, index: number): CotizacionItemPayload {
    const precio = this.parseNumberNullable(
      item?.precioUnitario ?? item?.precioUnit ?? item?.precio ?? item?.subtotal
    ) ?? 0;
    const cantidad = this.parseNumberNullable(item?.cantidad) ?? 1;
    const horas = this.parseNumberNullable(item?.horas);
    const personal = this.parseNumberNullable(item?.personal);
    const fotosImpresas = this.parseNumberNullable(item?.fotosImpresas);
    const trailerMin = this.parseNumberNullable(item?.trailerMin);
    const filmMin = this.parseNumberNullable(item?.filmMin);
    const descuento = this.parseNumberNullable(item?.descuento);
    const recargo = this.parseNumberNullable(item?.recargo);
    const opcion = this.parseNumberNullable(item?.opcion);
    const idEventoServicio = this.parseNumberNullable(
      item?.idEventoServicio ?? item?.eventoServicioId ?? item?.idCotizacionServicio
    );

    const titulo = item?.titulo ?? item?.nombre ?? item?.descripcion ?? `Item ${index + 1}`;
    const descripcion = item?.descripcion ?? item?.nombre ?? item?.titulo ?? undefined;
    const monedaRaw = item?.moneda ?? item?.currency ?? item?.Moneda ?? undefined;

    return {
      idEventoServicio: idEventoServicio != null ? idEventoServicio : undefined,
      grupo: item?.grupo ?? item?.Grupo ?? null,
      opcion: opcion != null ? opcion : null,
      titulo,
      descripcion,
      moneda: typeof monedaRaw === 'string' ? monedaRaw.toUpperCase() : undefined,
      precioUnitario: Number.isFinite(precio) ? precio : 0,
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
      descuento: descuento != null ? descuento : undefined,
      recargo: recargo != null ? recargo : undefined,
      notas: item?.notas ?? undefined,
      horas,
      personal,
      fotosImpresas,
      trailerMin,
      filmMin
    };
  }

  private normalizeIsoDate(value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        const direct = new Date(trimmed);
        if (!Number.isNaN(direct.valueOf())) {
          return direct.toISOString();
        }
        const normalized = trimmed.replace(' ', 'T');
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.valueOf())) {
          return parsed.toISOString();
        }
      }
    }
    return new Date().toISOString();
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
          contacto: cot.contacto,
          servicio: cot.servicio,
          evento: cot.evento,
          fecha: cot.fecha,
          estado: cot.estado,
          total: cot.total,
          notas: cot.notas,
          lugar: cot.lugar
        })}${raw ? JSON.stringify(raw) : ''}`.toLowerCase();
        const directValue = String((cot as any)[key] ?? '').toLowerCase();
        const candidate = `${directValue} ${serialized}`;
        return candidate.includes(String(value).toLowerCase());
      }))
      .map(c => this.cloneCotizacion(c));
  }
}



