import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { EquipoResumen } from '../models/equipo-resumen.model';
import { EquipoInventario } from '../models/equipo-inventario.model';
import { TipoEquipo } from '../models/tipo-equipo.model';
import { Marca } from '../models/marca.model';
import { Modelo } from '../models/modelo.model';

@Injectable({
  providedIn: 'root'
})
export class AdministrarEquiposService {
  private readonly resumenUrl = `${environment.baseUrl}/inventario/equipos/resumen`;
  private readonly inventarioUrl = `${environment.baseUrl}/inventario/equipos`;
  private readonly tiposUrl = `${environment.baseUrl}/inventario/tipos-equipo`;
  private readonly marcasUrl = `${environment.baseUrl}/inventario/marcas`;
  private readonly modelosUrl = `${environment.baseUrl}/inventario/modelos`;

  constructor(private readonly http: HttpClient) {}

  getResumenEquipos(): Observable<EquipoResumen[]> {
    return this.http.get<EquipoResumen[]>(this.resumenUrl);
  }

  getEquipos(params?: { tipo?: string; marca?: string; modelo?: string }): Observable<EquipoInventario[]> {
    let queryParams = new HttpParams();

    if (params?.tipo) {
      queryParams = queryParams.set('tipo', params.tipo);
    }

    if (params?.marca) {
      queryParams = queryParams.set('marca', params.marca);
    }

    if (params?.modelo) {
      queryParams = queryParams.set('modelo', params.modelo);
    }

    return this.http.get<EquipoInventario[]>(this.inventarioUrl, { params: queryParams });
  }

  getEquipoPorId(idEquipo: number): Observable<EquipoInventario> {
    return this.http.get<EquipoInventario>(`${this.inventarioUrl}/${idEquipo}`);
  }

  crearTipoEquipo(nombre: string): Observable<void> {
    return this.http.post<void>(this.tiposUrl, { nombre });
  }

  actualizarTipoEquipo(idTipoEquipo: number, nombre: string): Observable<void> {
    return this.http.put<void>(`${this.tiposUrl}/${idTipoEquipo}`, { nombre });
  }

  eliminarTipoEquipo(idTipoEquipo: number): Observable<void> {
    return this.http.delete<void>(`${this.tiposUrl}/${idTipoEquipo}`);
  }

  obtenerTipos(): Observable<TipoEquipo[]> {
    return this.http.get<TipoEquipo[]>(this.tiposUrl);
  }

  crearMarca(nombre: string): Observable<void> {
    return this.http.post<void>(this.marcasUrl, { nombre });
  }

  actualizarMarca(idMarca: number, nombre: string): Observable<void> {
    return this.http.put<void>(`${this.marcasUrl}/${idMarca}`, { nombre });
  }

  eliminarMarca(idMarca: number): Observable<void> {
    return this.http.delete<void>(`${this.marcasUrl}/${idMarca}`);
  }

  obtenerMarcas(): Observable<Marca[]> {
    return this.http.get<Marca[]>(this.marcasUrl);
  }

  crearModelo(payload: { nombre: string; idMarca: number; idTipoEquipo: number }): Observable<void> {
    return this.http.post<void>(this.modelosUrl, payload);
  }

  actualizarModelo(idModelo: number, payload: { nombre: string; idMarca: number; idTipoEquipo: number }): Observable<void> {
    return this.http.put<void>(`${this.modelosUrl}/${idModelo}`, payload);
  }

  eliminarModelo(idModelo: number): Observable<void> {
    return this.http.delete<void>(`${this.modelosUrl}/${idModelo}`);
  }

  obtenerModelos(): Observable<Modelo[]> {
    return this.http.get<Modelo[]>(this.modelosUrl);
  }

  crearEquipo(payload: { fechaIngreso: string; idModelo: number; idEstado: number; serie: string }): Observable<void> {
    return this.http.post<void>(this.inventarioUrl, payload);
  }

  actualizarEquipo(idEquipo: number, payload: { fechaIngreso: string; idModelo: number; idEstado: number; serie: string }): Observable<void> {
    return this.http.put<void>(`${this.inventarioUrl}/${idEquipo}`, payload);
  }

  eliminarEquipo(idEquipo: number): Observable<void> {
    return this.http.delete<void>(`${this.inventarioUrl}/${idEquipo}`);
  }
}
