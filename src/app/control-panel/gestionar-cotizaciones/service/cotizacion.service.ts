import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, delay } from 'rxjs/operators';

import { Cotizacion, CotizacionItemPayload, CotizacionPayload, CotizacionUpdatePayload } from '../model/cotizacion.model';
import { PedidoService } from '../../gestionar-pedido/service/pedido.service';
import { VisualizarService } from '../../gestionar-pedido/service/visualizar.service';

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

@Injectable({ providedIn: 'root' })
export class CotizacionService {
  private readonly latency = 250;
  private sequence = 3;

  private cotizaciones: Array<Cotizacion & { raw?: CotizacionPayload }> = [
    {
      id: 1,
      codigo: 'COT-001',
      cliente: 'Eventos Aurora SAC',
      contacto: 'Lucía Pérez',
      servicio: 'Cobertura audiovisual',
      evento: 'Gala corporativa',
      fecha: '2025-02-12',
      hora: '19:30',
      horasEstimadas: '6 horas',
      estado: 'Pendiente',
      total: 1850,
      notas: 'Cobertura audiovisual para gala anual.',
      pdfUrl: undefined,
      items: [
        { descripcion: 'Cobertura fotográfica', cantidad: 1, precioUnitario: 950 },
        { descripcion: 'Video highlight', cantidad: 1, precioUnitario: 900 }
      ],
      raw: {
        clienteId: 101,
        clienteNombre: 'Eventos Aurora SAC',
        clienteContacto: 'Lucía Pérez',
        servicioId: 1,
        servicioNombre: 'Cobertura audiovisual',
        eventoId: 1,
        eventoNombre: 'Gala corporativa',
        fechaEvento: '2025-02-12',
        horaEvento: '19:30',
        horasEstimadas: '6 horas',
        ubicacion: 'Hotel Belmond',
        direccionExacta: 'Av. Malecón 100, Miraflores',
        descripcion: 'Cobertura audiovisual para gala anual.',
        estado: 'Pendiente',
        observaciones: 'Se requiere armado previo de escenario.',
        items: [
          { descripcion: 'Cobertura fotográfica', cantidad: 1, precioUnitario: 950 },
          { descripcion: 'Video highlight', cantidad: 1, precioUnitario: 900 }
        ],
        totalEstimado: 1850
      }
    },
    {
      id: 2,
      codigo: 'COT-002',
      cliente: 'Colegio Santa María',
      contacto: 'Dirección Académica',
      servicio: 'Producción de eventos',
      evento: 'Fiesta de promoción',
      fecha: '2025-03-01',
      hora: '20:00',
      horasEstimadas: '5 horas',
      estado: 'Enviada',
      total: 1250,
      notas: 'Fiesta de promoción (turno noche).',
      pdfUrl: undefined,
      items: [
        { descripcion: 'DJ + sonido profesional', cantidad: 1, precioUnitario: 750 },
        { descripcion: 'Iluminación ambiental', cantidad: 1, precioUnitario: 500 }
      ],
      raw: {
        clienteId: 102,
        clienteNombre: 'Colegio Santa María',
        clienteContacto: 'Dirección Académica',
        servicioId: 2,
        servicioNombre: 'Producción de eventos',
        eventoId: 2,
        eventoNombre: 'Fiesta de promoción',
        fechaEvento: '2025-03-01',
        horaEvento: '20:00',
        horasEstimadas: '5 horas',
        ubicacion: 'Auditorio principal',
        direccionExacta: 'Av. Arequipa 920, Lima',
        descripcion: 'Fiesta de promoción (turno noche).',
        estado: 'Enviada',
        observaciones: 'Se adjunta plano del auditorio.',
        items: [
          { descripcion: 'DJ + sonido profesional', cantidad: 1, precioUnitario: 750 },
          { descripcion: 'Iluminación ambiental', cantidad: 1, precioUnitario: 500 }
        ],
        totalEstimado: 1250
      }
    },
    {
      id: 3,
      codigo: 'COT-003',
      cliente: 'Bodas Nube Rosa',
      contacto: 'Vanessa Ríos',
      servicio: 'Cobertura integral',
      evento: 'Boda destino',
      fecha: '2025-04-20',
      hora: '16:00',
      horasEstimadas: '8 horas',
      estado: 'Aceptada',
      total: 2640,
      notas: 'Boda destino con dos ceremonias.',
      pdfUrl: undefined,
      items: [
        { descripcion: 'Cobertura foto + video', cantidad: 1, precioUnitario: 1800 },
        { descripcion: 'Drone y tomas aéreas', cantidad: 1, precioUnitario: 840 }
      ],
      raw: {
        clienteId: 103,
        clienteNombre: 'Bodas Nube Rosa',
        clienteContacto: 'Vanessa Ríos',
        servicioId: 1,
        servicioNombre: 'Cobertura integral',
        eventoId: 3,
        eventoNombre: 'Boda destino',
        fechaEvento: '2025-04-20',
        horaEvento: '16:00',
        horasEstimadas: '8 horas',
        ubicacion: 'Hacienda Los Álamos',
        direccionExacta: 'Km 58 Panamericana Sur',
        descripcion: 'Boda destino con dos ceremonias.',
        estado: 'Aceptada',
        observaciones: 'Incluye viáticos para el staff.',
        items: [
          { descripcion: 'Cobertura foto + video', cantidad: 1, precioUnitario: 1800 },
          { descripcion: 'Drone y tomas aéreas', cantidad: 1, precioUnitario: 840 }
        ],
        totalEstimado: 2640
      }
    }
  ];

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
    private readonly pedidoService: PedidoService,
    private readonly visualizarService: VisualizarService
  ) {}

  listCotizaciones(filters?: Record<string, string | number | null | undefined>): Observable<Cotizacion[]> {
    const data = this.applyFilters(this.cotizaciones, filters);
    return of(data.map(c => ({ ...c }))).pipe(delay(this.latency));
  }

  getCotizacion(id: number | string): Observable<Cotizacion> {
    const numericId = Number(id);
    const found = this.cotizaciones.find(c => c.id === numericId);
    if (!found) {
      return throwError(() => new Error('Cotización no encontrada'));
    }
    return of({ ...found }).pipe(delay(this.latency));
  }

  createCotizacion(payload: CotizacionPayload): Observable<Cotizacion> {
    this.sequence += 1;
    const newCotizacion = this.buildCotizacion(this.sequence, payload);
    this.cotizaciones = [newCotizacion, ...this.cotizaciones];
    return of({ ...newCotizacion }).pipe(delay(this.latency));
  }

  updateCotizacion(id: number | string, payload: CotizacionUpdatePayload): Observable<Cotizacion> {
    const numericId = Number(id);
    let updated: (Cotizacion & { raw?: CotizacionPayload }) | undefined;

    this.cotizaciones = this.cotizaciones.map(cot => {
      if (cot.id !== numericId) return cot;
      const mergedPayload: CotizacionPayload = { ...cot.raw, ...payload } as CotizacionPayload;
      updated = this.buildCotizacion(cot.id, mergedPayload, cot.codigo);
      return updated;
    });

    if (!updated) {
      return throwError(() => new Error('Cotización no encontrada'));
    }

    return of({ ...updated }).pipe(delay(this.latency));
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

  private buildCotizacion(id: number, payload: CotizacionPayload, codigo?: string): Cotizacion & { raw?: CotizacionPayload } {
    const items = Array.isArray(payload.items) ? payload.items.filter(Boolean) : [];
    const totalFromItems = items.reduce((acc, item) => acc + (Number(item?.cantidad ?? 0) * Number(item?.precioUnitario ?? 0)), 0);
    const total = payload.totalEstimado ?? (totalFromItems || undefined) ?? 0;

    const contacto = payload.clienteContacto ? String(payload.clienteContacto).trim() : undefined;

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
      raw: { ...payload, totalEstimado: total, clienteContacto: contacto }
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
      return data.map(c => ({ ...c }));
    }
    const entries = Object.entries(filters).filter(([_, value]) => value !== null && value !== undefined && value !== '');
    if (!entries.length) {
      return data.map(c => ({ ...c }));
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
      .map(c => ({ ...c }));
  }
}
