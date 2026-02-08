import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  DashboardAlertasResponse,
  DashboardCapacidadResponse,
  DashboardKpisResponse,
  DashboardResumenResponse,
  OperacionesAgendaResponse
} from '../model/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.baseUrl}/operaciones`;

  getDashboardResumen(): Observable<DashboardResumenResponse> {
    return this.http.get<DashboardResumenResponse>(`${this.API}/dashboard/resumen`);
  }

  getDashboardAlertas(): Observable<DashboardAlertasResponse> {
    return this.http.get<DashboardAlertasResponse>(`${this.API}/dashboard/alertas`);
  }

  getDashboardKpis(): Observable<DashboardKpisResponse> {
    return this.http.get<DashboardKpisResponse>(`${this.API}/dashboard/kpis`);
  }

  getAgenda(from?: string | null, to?: string | null): Observable<OperacionesAgendaResponse> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<OperacionesAgendaResponse>(`${this.API}/agenda`, { params });
  }

  getCapacidad(from?: string | null, to?: string | null): Observable<DashboardCapacidadResponse> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<DashboardCapacidadResponse>(`${this.API}/dashboard/capacidad`, { params });
  }
}
