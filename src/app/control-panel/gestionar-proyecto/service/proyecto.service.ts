import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  Proyecto,
  ProyectoAsignacionesDisponiblesResponse,
  ProyectoAsignacionesPayload,
  ProyectoDetalleResponse,
  ProyectoDiaEstadoResponse,
  ProyectoEstadoResponse,
  ProyectoIncidenciaPayload,
  ProyectoPayload,
  ProyectoDevolucionEquiposPayload,
  ProyectoDevolucionEquipoParcialPayload
} from '../model/proyecto.model';
import { PedidoRequerimientos } from '../model/detalle-proyecto.model';
import { ProyectoDisponibilidad } from '../model/proyecto-disponibilidad.model';

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly API = `${environment.baseUrl}/proyecto`;

  private readonly http = inject(HttpClient);
  private estadosProyecto$: Observable<ProyectoEstadoResponse['data']> | null = null;
  private estadosDias$: Observable<ProyectoDiaEstadoResponse['data']> | null = null;

  getProyectos(): Observable<Proyecto[]> {
    return this.http.get<Proyecto[]>(this.API);
  }

  getProyecto(id: number): Observable<ProyectoDetalleResponse> {
    return this.http.get<ProyectoDetalleResponse>(`${this.API}/${id}`);
  }

  getPedidoRequerimientos(pedidoId: number): Observable<PedidoRequerimientos> {
    return this.http.get<PedidoRequerimientos>(`${environment.baseUrl}/pedido/${pedidoId}/requerimientos`);
  }

  crearProyecto(payload: ProyectoPayload): Observable<Proyecto> {
    return this.http.post<Proyecto>(this.API, payload);
  }

  actualizarProyecto(id: number, payload: Partial<ProyectoPayload>): Observable<Proyecto> {
    return this.http.put<Proyecto>(`${this.API}/${id}`, payload);
  }

  actualizarProyectoParcial(
    id: number,
    payload: Partial<ProyectoPayload>
  ): Observable<{ status: string; proyectoId: number }> {
    return this.http.patch<{ status: string; proyectoId: number }>(`${this.API}/${id}`, payload);
  }

  upsertAsignaciones(payload: ProyectoAsignacionesPayload): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(`${this.API}/asignaciones`, payload);
  }

  crearIncidencia(diaId: number, payload: ProyectoIncidenciaPayload): Observable<{ status: string; incidenciaId?: number; diaId?: number; fechaHoraEvento?: string | null }> {
    return this.http.post<{ status: string; incidenciaId?: number; diaId?: number; fechaHoraEvento?: string | null }>(`${this.API}/dias/${diaId}/incidencias`, payload);
  }

  registrarDevolucionesDia(diaId: number, payload: ProyectoDevolucionEquiposPayload): Observable<{ status: string; diaId: number; equiposActualizados: number }> {
    return this.http.post<{ status: string; diaId: number; equiposActualizados: number }>(
      `${this.API}/dias/${diaId}/equipos/devolucion`,
      payload
    );
  }

  registrarDevolucionEquipo(
    diaId: number,
    equipoId: number,
    payload: ProyectoDevolucionEquipoParcialPayload
  ): Observable<{ status: string; diaId: number; equiposActualizados: number }> {
    return this.http.patch<{ status: string; diaId: number; equiposActualizados: number }>(
      `${this.API}/dias/${diaId}/equipos/${equipoId}/devolucion`,
      payload
    );
  }

  getAsignacionesDisponibles(params: {
    fecha?: string;
    fechaInicio?: string;
    fechaFin?: string;
    proyectoId?: number;
    cargoId?: number;
    tipoEquipoId?: number;
  }): Observable<ProyectoAsignacionesDisponiblesResponse> {
    let queryParams = new HttpParams();
    if (params.fecha) {
      queryParams = queryParams.set('fecha', params.fecha);
    }
    if (params.fechaInicio) {
      queryParams = queryParams.set('fechaInicio', params.fechaInicio);
    }
    if (params.fechaFin) {
      queryParams = queryParams.set('fechaFin', params.fechaFin);
    }
    if (params.proyectoId !== undefined && params.proyectoId !== null) {
      queryParams = queryParams.set('proyectoId', String(params.proyectoId));
    }
    if (params.cargoId !== undefined && params.cargoId !== null) {
      queryParams = queryParams.set('cargoId', String(params.cargoId));
    }
    if (params.tipoEquipoId !== undefined && params.tipoEquipoId !== null) {
      queryParams = queryParams.set('tipoEquipoId', String(params.tipoEquipoId));
    }
    return this.http.get<ProyectoAsignacionesDisponiblesResponse>(`${this.API}/asignaciones/disponibles`, { params: queryParams });
  }

  getEstadosProyecto(): Observable<ProyectoEstadoResponse['data']> {
    if (!this.estadosProyecto$) {
      this.estadosProyecto$ = this.http
        .get<ProyectoEstadoResponse>(`${this.API}/estados`)
        .pipe(
          map(response => Array.isArray(response?.data) ? response.data : []),
          catchError(() => of([])),
          shareReplay(1)
        );
    }
    return this.estadosProyecto$;
  }

  getEstadosDias(): Observable<ProyectoDiaEstadoResponse['data']> {
    if (!this.estadosDias$) {
      this.estadosDias$ = this.http
        .get<ProyectoDiaEstadoResponse>(`${this.API}/dias/estados`)
        .pipe(
          map(response => Array.isArray(response?.data) ? response.data : []),
          catchError(() => of([])),
          shareReplay(1)
        );
    }
    return this.estadosDias$;
  }

  getDisponibilidad(params: { fechaInicio: string; fechaFin: string; proyectoId?: number | null }): Observable<ProyectoDisponibilidad> {
    let queryParams = new HttpParams()
      .set('fechaInicio', params.fechaInicio)
      .set('fechaFin', params.fechaFin);

    if (params.proyectoId !== undefined && params.proyectoId !== null) {
      queryParams = queryParams.set('proyectoId', String(params.proyectoId));
    }

    return this.http.get<ProyectoDisponibilidad>(`${this.API}/disponibilidad`, { params: queryParams });
  }
}
