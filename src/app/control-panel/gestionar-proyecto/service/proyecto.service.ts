import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Proyecto, ProyectoDetalle, ProyectoPayload, ProyectoRecurso } from '../model/proyecto.model';
import { PedidoRequerimientos } from '../model/detalle-proyecto.model';
import { ProyectoDisponibilidad } from '../model/proyecto-disponibilidad.model';

export interface ProyectoEstado {
  estadoId: number;
  estadoNombre: string;
}

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly API = `${environment.baseUrl}/proyecto`;

  private readonly http = inject(HttpClient);

  getProyectos(): Observable<Proyecto[]> {
    return this.http.get<Proyecto[]>(this.API);
  }

  getProyecto(id: number): Observable<ProyectoDetalle> {
    return this.http.get<ProyectoDetalle>(`${this.API}/${id}`);
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

  getEstados(): Observable<ProyectoEstado[]> {
    return this.http.get<ProyectoEstado[]>(`${this.API}/estados`);
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

  guardarRecursos(payload: {
    proyectoId: number;
    asignaciones: {
      empleadoId: number | null;
      equipoId: number;
      fechaInicio: string;
      fechaFin: string;
      notas: string;
    }[];
  }): Observable<void> {
    return this.http.post<void>(`${this.API}/recursos`, payload);
  }

  getAsignaciones(proyectoId: number): Observable<ProyectoRecurso[]> {
    return this.http.get<ProyectoRecurso[]>(`${this.API}/${proyectoId}/asignaciones`);
  }

  registrarDevoluciones(
    proyectoId: number,
    payload: { devoluciones: { equipoId: number; estadoDevolucion: string; notas: string }[] }
  ): Observable<void> {
    return this.http.post<void>(`${this.API}/${proyectoId}/devolucion`, payload);
  }
}
