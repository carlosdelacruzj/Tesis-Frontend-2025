import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ResumenEquipo {
  idTipoEquipo: number;
  nombreTipoEquipo: string;
  idMarca: number;
  nombreMarca: string;
  idModelo: number;
  nombreModelo: string;
  cantidad: number;
}

export interface EquipoInventario {
  idEquipo: number;
  fechaIngreso: string;
  idModelo: number;
  nombreModelo: string;
  idMarca: number;
  nombreMarca: string;
  idTipoEquipo: number;
  nombreTipoEquipo: string;
  idEstado: number;
  nombreEstado: string;
  serie: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdministrarEquipos2Service {
  private readonly resumenUrl = `${environment.baseUrl}/inventario/equipos/resumen`;
  private readonly inventarioUrl = `${environment.baseUrl}/inventario/equipos`;

  constructor(private readonly http: HttpClient) {}

  getResumenEquipos(): Observable<ResumenEquipo[]> {
    return this.http.get<ResumenEquipo[]>(this.resumenUrl);
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
}
