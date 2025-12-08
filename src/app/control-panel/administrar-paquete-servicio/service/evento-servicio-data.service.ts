import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Evento,
  EventoServicioDetalle,
  EventoServicioCategoria,
  Servicio,
  CrearEventoServicioRequest,
  ActualizarEventoServicioRequest,
  EstadoEventoServicio,
  ActualizarEstadoEventoServicioResponse
} from '../model/evento-servicio.model';
import { TipoEquipo } from '../../administrar-equipos/models/tipo-equipo.model';

@Injectable({ providedIn: 'root' })
export class EventoServicioDataService {
  private readonly baseUrl = environment.baseUrl;

  constructor(private readonly http: HttpClient) {}

  getEventos(): Observable<Evento[]> {
    return this.http.get<Evento[]>(`${this.baseUrl}/eventos`);
  }

  getEventoPorId(id: number): Observable<Evento> {
    return this.http.get<Evento>(`${this.baseUrl}/eventos/${id}`);
  }

  crearEvento(nombre: string, iconUrl?: string | null): Observable<any> {
    const body: Record<string, unknown> = { nombre };
    if (iconUrl !== undefined) {
      body['iconUrl'] = iconUrl;
    }
    return this.http.post(`${this.baseUrl}/eventos`, body);
  }

  actualizarEvento(id: number, nombre?: string, iconUrl?: string | null): Observable<any> {
    const body: Record<string, unknown> = {};
    if (nombre !== undefined) {
      body['nombre'] = nombre;
    }
    if (iconUrl !== undefined) {
      body['iconUrl'] = iconUrl;
    }
    return this.http.put(`${this.baseUrl}/eventos/${id}`, body);
  }

  getServicios(): Observable<Servicio[]> {
    return this.http.get<Servicio[]>(`${this.baseUrl}/servicios`);
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
    return this.http.get<EstadoEventoServicio[]>(`${this.baseUrl}/eventos_servicios/estados`);
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

  crearEventoServicio(payload: CrearEventoServicioRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/eventos_servicios`, payload);
  }

  actualizarEventoServicio(id: number, payload: ActualizarEventoServicioRequest): Observable<any> {
    return this.http.put(`${this.baseUrl}/eventos_servicios/${id}`, payload);
  }

  actualizarEstadoEventoServicio(id: number, estadoId: number): Observable<ActualizarEstadoEventoServicioResponse> {
    return this.http.patch<ActualizarEstadoEventoServicioResponse>(
      `${this.baseUrl}/eventos_servicios/${id}/estado`,
      { estadoId }
    );
  }

  getCategoriasEventoServicio(): Observable<EventoServicioCategoria[]> {
    return this.http.get<EventoServicioCategoria[]>(`${this.baseUrl}/eventos_servicios/categorias`);
  }

  getTiposEquipo(): Observable<TipoEquipo[]> {
    return this.http.get<TipoEquipo[]>(`${this.baseUrl}/inventario/tipos-equipo`);
  }

  crearServicio(nombre: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/servicios`, { nombre });
  }

  actualizarServicio(id: number, nombre: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/servicios/${id}`, { nombre });
  }
}
