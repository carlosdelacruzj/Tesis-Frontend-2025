import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Proyecto, ProyectoDetalle, ProyectoPayload, ProyectoRecurso } from '../model/proyecto.model';
import { PedidoRequerimientos } from '../model/detalle-proyecto.model';

@Injectable({ providedIn: 'root' })
export class ProyectoService {
  private readonly API = `${environment.baseUrl}/proyecto`;

  constructor(private http: HttpClient) {}

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

  getEstados(): Observable<any[]> {
    return this.http.get<any[]>(`${this.API}/estados`);
  }

  guardarRecursos(payload: {
    proyectoId: number;
    asignaciones: Array<{
      empleadoId: number | null;
      equipoId: number;
      fechaInicio: string;
      fechaFin: string;
      notas: string;
    }>;
  }): Observable<void> {
    return this.http.post<void>(`${this.API}/recursos`, payload);
  }

  getAsignaciones(proyectoId: number): Observable<ProyectoRecurso[]> {
    return this.http.get<ProyectoRecurso[]>(`${this.API}/${proyectoId}/asignaciones`);
  }
}
