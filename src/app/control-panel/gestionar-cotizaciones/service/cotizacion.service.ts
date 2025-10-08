import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, delay, map, tap } from 'rxjs/operators';

import { Cotizacion, CotizacionItemPayload, CotizacionPayload, CotizacionUpdatePayload, CotizacionLead } from '../model/cotizacion.model';
import { PedidoService } from '../../gestionar-pedido/service/pedido.service';
import { VisualizarService } from '../../gestionar-pedido/service/visualizar.service';
import { environment } from '../../../../environments/environment';

interface MockCatalogo {
  id: number;
  nombre: string;
  descripcion?: string;
}

interface MockEventoServicio {
  idEventoServicio: number;
  eventoId: number;
  servicioId: number;
  descripcion: string;
  precio: number;
  staff: number;
  horas: number;
}

interface CotizacionApiResponse {
  id: number;
  estado?: string | null;
  fechaCreacion?: string | null;
  tipoEvento?: string | null;
  fechaEvento?: string | null;
  lugar?: string | null;
  horasEstimadas?: string | null;
  mensaje?: string | null;
  lead?: CotizacionLead | null;
}

@Injectable({ providedIn: 'root' })
export class CotizacionService {
  private readonly latency = 250;
  private readonly baseUrl = `${environment.baseUrl}/cotizaciones`;
  private sequence = 0;

  private cotizaciones: Array<Cotizacion & { raw?: CotizacionPayload }> = [];

  private readonly mockServicios: MockCatalogo[] = [
    { id: 1, nombre: 'Cobertura audiovisual', descripcion: 'Foto y video profesional' },
    { id: 2, nombre: 'Producción de eventos', descripcion: 'Producción integral de eventos' },
    { id: 3, nombre: 'Wedding planning', descripcion: 'Planeación y ejecución de bodas' }
  ];

  private readonly mockEventos: MockCatalogo[] = [
    { id: 1, nombre: 'Gala corporativa' },
    { id: 2, nombre: 'Fiesta de promoción' },
    { id: 3, nombre: 'Boda destino' },
    { id: 4, nombre: 'Aniversario empresarial' }
  ];

  private readonly mockEventosServicio: MockEventoServicio[] = [
    { idEventoServicio: 201, eventoId: 1, servicioId: 1, descripcion: 'Cobertura fotográfica premium', precio: 950, staff: 2, horas: 6 },
    { idEventoServicio: 202, eventoId: 1, servicioId: 1, descripcion: 'Video highlight corporativo', precio: 900, staff: 3, horas: 6 },
    { idEventoServicio: 203, eventoId: 2, servicioId: 2, descripcion: 'DJ + sonido profesional', precio: 750, staff: 2, horas: 5 },
    { idEventoServicio: 204, eventoId: 2, servicioId: 2, descripcion: 'Iluminación ambiental LED', precio: 500, staff: 1, horas: 5 },
    { idEventoServicio: 205, eventoId: 3, servicioId: 3, descripcion: 'Cobertura foto + video bodas', precio: 1800, staff: 3, horas: 8 },
    { idEventoServicio: 206, eventoId: 3, servicioId: 3, descripcion: 'Drone y tomas aéreas', precio: 840, staff: 1, horas: 2 },
    { idEventoServicio: 207, eventoId: 4, servicioId: 1, descripcion: 'Streaming en vivo', precio: 1200, staff: 3, horas: 4 },
    { idEventoServicio: 208, eventoId: 4, servicioId: 2, descripcion: 'Escenario modular + iluminación', precio: 1500, staff: 4, horas: 8 }
  ];

  constructor(
    private readonly http: HttpClient,
    private readonly pedidoService: PedidoService,
    private readonly visualizarService: VisualizarService
  ) {}

  listCotizaciones(filters?: Record<string, string | number | null | undefined>): Observable<Cotizacion[]> {
    return this.http.get<CotizacionApiResponse[]>(this.baseUrl).pipe(
      map(items => items.map(item => this.normalizeApiCotizacion(item))),
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
      return throwError(() => new Error('Identificador de cotización inválido'));
    }

    const cached = this.cotizaciones.find(c => c.id === numericId);
    if (cached) {
      return of(this.cloneCotizacion(cached));
    }

    return this.http.get<CotizacionApiResponse>(`${this.baseUrl}/${numericId}`).pipe(
      map(item => this.normalizeApiCotizacion(item)),
      tap(cotizacion => this.upsertCotizacion(cotizacion)),
      map(cotizacion => this.cloneCotizacion(cotizacion)),
      catchError(err => throwError(() => err))
    );
  }

  createCotizacion(payload: CotizacionPayload): Observable<Cotizacion> {
    this.sequence += 1;
    const newCotizacion = this.buildCotizacion(this.sequence, payload);
    this.upsertCotizacion(newCotizacion, true);
    return of(this.cloneCotizacion(newCotizacion)).pipe(delay(this.latency));
  }

  updateCotizacion(id: number | string, payload: CotizacionUpdatePayload): Observable<Cotizacion> {
    const numericId = Number(id);
    const index = this.cotizaciones.findIndex(cot => cot.id === numericId);
    if (index === -1) {
      return throwError(() => new Error('Cotización no encontrada'));
    }

    const base = this.cotizaciones[index];
    const mergedPayload: CotizacionPayload = { ...base.raw, ...payload } as CotizacionPayload;
    const updated = this.buildCotizacion(base.id, mergedPayload, base.codigo);
    this.cotizaciones[index] = this.cloneCotizacion(updated);
    this.sequence = Math.max(this.sequence, updated.id);
    return of(this.cloneCotizacion(updated)).pipe(delay(this.latency));
  }

  downloadPdf(id: number | string): Observable<Blob> {
    const content = `Cotización ${id}\nEste documento es un PDF de demostración generado desde el front.`;
    const blob = new Blob([content], { type: 'application/pdf' });
    return of(blob).pipe(delay(this.latency));
  }

  getServicios(): Observable<any[]> {
    const obs: any = this.pedidoService?.getServicios?.();
    if (obs && typeof obs.pipe === 'function') {
      return obs.pipe(
        catchError(err => {
          console.warn('[cotizaciones] getServicios fallback', err);
          return of(this.mockServicios);
        })
      );
    }
    return of(this.mockServicios).pipe(delay(this.latency));
  }

  getEventos(): Observable<any[]> {
    const obs: any = this.pedidoService?.getEventos?.();
    if (obs && typeof obs.pipe === 'function') {
      return obs.pipe(
        catchError(err => {
          console.warn('[cotizaciones] getEventos fallback', err);
          return of(this.mockEventos);
        })
      );
    }
    return of(this.mockEventos).pipe(delay(this.latency));
  }

  getEventosServicio(eventoId?: number | null, servicioId?: number | null): Observable<any[]> {
    const obs: any = this.visualizarService?.getEventosServicio?.(eventoId ?? undefined, servicioId ?? undefined);
    if (obs && typeof obs.pipe === 'function') {
      return obs.pipe(
        catchError(err => {
          console.warn('[cotizaciones] getEventosServicio fallback', err);
          return of(this.getMockEventosServicio(eventoId, servicioId));
        })
      );
    }
    return of(this.getMockEventosServicio(eventoId, servicioId)).pipe(delay(this.latency));
  }

  private normalizeApiCotizacion(api: CotizacionApiResponse): Cotizacion & { raw?: CotizacionPayload } {
    const fechaEvento = api.fechaEvento ?? api.fechaCreacion ?? new Date().toISOString();
    const rawHoras = api.horasEstimadas != null ? String(api.horasEstimadas).trim() : '';
    const horas = rawHoras
      ? /\b(h|horas?)$/i.test(rawHoras)
        ? rawHoras
        : `${rawHoras} h`
      : undefined;

    const tipoEvento = api.tipoEvento ?? (api as any).tipoServicio ?? undefined;

    const payload: CotizacionPayload = {
      clienteNombre: api.lead?.nombre ?? '',
      clienteContacto: api.lead?.celular ?? '',
      fechaEvento,
      horasEstimadas: horas,
      ubicacion: api.lugar ?? '',
      descripcion: api.mensaje ?? '',
      servicioNombre: tipoEvento,
      eventoNombre: tipoEvento,
      estado: api.estado ?? undefined,
      items: []
    };

    const normalized = this.buildCotizacion(api.id, payload);
    normalized.estado = api.estado ?? normalized.estado;
    normalized.notas = api.mensaje ?? normalized.notas;
    normalized.lugar = api.lugar ?? normalized.lugar;
    normalized.createdAt = api.fechaCreacion ?? normalized.createdAt;
    normalized.lead = api.lead ? { ...api.lead } : normalized.lead;
    normalized.evento = normalized.evento || tipoEvento;
    normalized.eventoSolicitado = tipoEvento ?? normalized.eventoSolicitado;

    const rawPayload = (normalized.raw ?? payload) as CotizacionPayload;
    normalized.raw = {
      ...(rawPayload as any),
      estado: api.estado ?? rawPayload.estado,
      lead: api.lead ? { ...api.lead } : undefined,
      fechaCreacion: api.fechaCreacion ?? undefined,
      tipoEvento
    } as CotizacionPayload & { lead?: CotizacionLead; fechaCreacion?: string | null; tipoEvento?: string | null };

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
    const items = Array.isArray(payload.items) ? payload.items.filter(Boolean) : [];
    const totalFromItems = items.reduce((acc, item) => acc + (Number(item?.cantidad ?? 0) * Number(item?.precioUnitario ?? 0)), 0);
    const total = payload.totalEstimado ?? (totalFromItems || undefined) ?? 0;

    const contacto = payload.clienteContacto ? String(payload.clienteContacto).trim() : undefined;
    const lead: CotizacionLead | undefined = payload.clienteNombre || contacto
      ? {
          nombre: payload.clienteNombre,
          celular: contacto
        }
      : undefined;
    const eventoSolicitado = payload.eventoNombre || payload.servicioNombre || undefined;

    const normalized: Cotizacion & { raw?: CotizacionPayload } = {
      id,
      codigo: codigo ?? `COT-${String(id).padStart(3, '0')}`,
      cliente: payload.clienteNombre || (payload.clienteId ? `Cliente #${payload.clienteId}` : 'Cliente sin nombre'),
      contacto,
      servicio: payload.servicioNombre,
      evento: payload.eventoNombre,
      fecha: payload.fechaEvento,
      hora: payload.horaEvento,
      horasEstimadas: payload.horasEstimadas,
      estado: payload.estado ?? 'Pendiente',
      total,
      notas: payload.descripcion,
      pdfUrl: undefined,
      items,
      raw: { ...payload, totalEstimado: total, clienteContacto: contacto },
      lugar: payload.ubicacion,
      createdAt: undefined,
      lead,
      eventoSolicitado
    };

    return normalized;
  }

  private getMockEventosServicio(eventoId?: number | null, servicioId?: number | null): MockEventoServicio[] {
    return this.mockEventosServicio.filter(item => {
      const matchEvento = eventoId == null || eventoId === 0 || item.eventoId === Number(eventoId);
      const matchServicio = servicioId == null || servicioId === 0 || item.servicioId === Number(servicioId);
      return matchEvento && matchServicio;
    });
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
        const haystack = String(
          (cot as any)[key] ??
          (cot.raw as any)?.[key] ??
          ''
        ).toLowerCase();
        return haystack.includes(String(value).toLowerCase());
      }))
      .map(c => this.cloneCotizacion(c));
  }
}
