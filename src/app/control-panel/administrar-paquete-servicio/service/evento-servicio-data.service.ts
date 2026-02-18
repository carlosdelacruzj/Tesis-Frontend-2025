import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Evento, EventoServicioDetalle, EventoServicioCategoria, Servicio, CrearEventoServicioRequest, ActualizarEventoServicioRequest, EstadoEventoServicio, ActualizarEstadoEventoServicioResponse, EventoSchemaResponse, EventoSchemaUpdatePayload, EventoSchemaUpdateResponse, EventoCreatePayload, EventoUpdatePayload, EventoUpsertResponse } from '../model/evento-servicio.model';
import { TipoEquipo } from '../../administrar-equipos/models/tipo-equipo.model';
import { CatalogosService } from 'src/app/shared/services/catalogos.service';

@Injectable({ providedIn: 'root' })
export class EventoServicioDataService {
  private readonly baseUrl = environment.baseUrl;

  private readonly http = inject(HttpClient);
  private readonly catalogos = inject(CatalogosService);

  getEventos(forceRefresh = false): Observable<Evento[]> {
    if (forceRefresh) {
      this.catalogos.invalidate('eventos');
    }
    return this.catalogos.getEventos();
  }

  getEventoPorId(id: number): Observable<Evento> {
    return this.http.get<Evento>(`${this.baseUrl}/eventos/${id}`);
  }

  getEventoSchema(id: number): Observable<EventoSchemaResponse> {
    return this.http.get<EventoSchemaResponse>(`${this.baseUrl}/eventos/${id}/schema`);
  }

  actualizarEventoSchema(id: number, payload: EventoSchemaUpdatePayload): Observable<EventoSchemaUpdateResponse> {
    return this.http.put<EventoSchemaUpdateResponse>(`${this.baseUrl}/eventos/${id}/schema`, payload);
  }

  crearEvento(nombre: string, iconUrl?: string | null): Observable<Evento | EventoUpsertResponse>;
  crearEvento(payload: EventoCreatePayload): Observable<Evento | EventoUpsertResponse>;
  crearEvento(nombreOrPayload: string | EventoCreatePayload, iconUrl?: string | null): Observable<Evento | EventoUpsertResponse> {
    const payload: EventoCreatePayload =
      typeof nombreOrPayload === 'string'
        ? { nombre: nombreOrPayload, iconUrl }
        : nombreOrPayload;
    const body = this.buildEventoMultipartPayload(payload);

    return this.http.post<Evento | EventoUpsertResponse>(`${this.baseUrl}/eventos`, body).pipe(
      tap(() => this.catalogos.invalidate('eventos'))
    );
  }

  actualizarEvento(id: number, nombre?: string, iconUrl?: string | null): Observable<Evento | EventoUpsertResponse>;
  actualizarEvento(id: number, payload: EventoUpdatePayload): Observable<Evento | EventoUpsertResponse>;
  actualizarEvento(id: number, nombreOrPayload?: string | EventoUpdatePayload, iconUrl?: string | null): Observable<Evento | EventoUpsertResponse> {
    const payload: EventoUpdatePayload =
      (typeof nombreOrPayload === 'object' && nombreOrPayload !== null)
        ? nombreOrPayload
        : { nombre: typeof nombreOrPayload === 'string' ? nombreOrPayload : undefined, iconUrl };
    const body = this.buildEventoMultipartPayload(payload);

    return this.http.put<Evento | EventoUpsertResponse>(`${this.baseUrl}/eventos/${id}`, body).pipe(
      tap(() => this.catalogos.invalidate('eventos'))
    );
  }

  getServicios(): Observable<Servicio[]> {
    return this.catalogos.getServicios();
  }

  getServicioPorId(id: number): Observable<Servicio> {
    return this.http.get<Servicio>(`${this.baseUrl}/servicios/${id}`);
  }

  getEventoServicios(): Observable<EventoServicioDetalle[]> {
    return this.http.get<EventoServicioDetalle[]>(`${this.baseUrl}/eventos_servicios`);
  }

  getEventoServicioPorId(id: number): Observable<EventoServicioDetalle> {
    return this.http.get<EventoServicioDetalle>(`${this.baseUrl}/eventos_servicios/${id}`);
  }

  getEstadosEventoServicio(): Observable<EstadoEventoServicio[]> {
    return this.catalogos.getEstadosEventoServicio();
  }

  getEventoServiciosFiltrado(eventoId?: number, servicioId?: number): Observable<EventoServicioDetalle[]> {
    const params: Record<string, string> = {};
    if (eventoId !== undefined && eventoId !== null) {
      params['evento'] = String(eventoId);
    }
    if (servicioId !== undefined && servicioId !== null) {
      params['servicio'] = String(servicioId);
    }
    return this.http.get<EventoServicioDetalle[]>(`${this.baseUrl}/eventos_servicios`, {
      params
    });
  }

  crearEventoServicio(payload: CrearEventoServicioRequest): Observable<EventoServicioDetalle> {
    return this.http.post<EventoServicioDetalle>(`${this.baseUrl}/eventos_servicios`, payload);
  }

  actualizarEventoServicio(id: number, payload: ActualizarEventoServicioRequest): Observable<EventoServicioDetalle> {
    return this.http.put<EventoServicioDetalle>(`${this.baseUrl}/eventos_servicios/${id}`, payload);
  }

  actualizarEstadoEventoServicio(id: number, estadoId: number): Observable<ActualizarEstadoEventoServicioResponse> {
    return this.http.patch<ActualizarEstadoEventoServicioResponse>(
      `${this.baseUrl}/eventos_servicios/${id}/estado`,
      { estadoId }
    );
  }

  getCategoriasEventoServicio(): Observable<EventoServicioCategoria[]> {
    return this.catalogos.getCategoriasEventoServicio();
  }

  getTiposEquipo(): Observable<TipoEquipo[]> {
    return this.catalogos.getTiposEquipo();
  }

  crearServicio(nombre: string): Observable<Servicio> {
    return this.http.post<Servicio>(`${this.baseUrl}/servicios`, { nombre }).pipe(
      tap(() => this.catalogos.invalidate('servicios'))
    );
  }

  actualizarServicio(id: number, nombre: string): Observable<Servicio> {
    return this.http.put<Servicio>(`${this.baseUrl}/servicios/${id}`, { nombre }).pipe(
      tap(() => this.catalogos.invalidate('servicios'))
    );
  }

  private buildEventoMultipartPayload(payload: EventoCreatePayload | EventoUpdatePayload): FormData {
    const fd = new FormData();

    const nombre = payload?.nombre?.trim();
    if (nombre) {
      fd.append('nombre', nombre);
    }
    if (payload?.icon instanceof File) {
      fd.append('icon', payload.icon);
    }
    if (payload?.iconUrl !== undefined && payload?.iconUrl !== null) {
      fd.append('iconUrl', payload.iconUrl);
    }
    if (payload?.formSchema !== undefined && payload?.formSchema !== null) {
      fd.append('formSchema', JSON.stringify(payload.formSchema));
    }

    return fd;
  }
}
