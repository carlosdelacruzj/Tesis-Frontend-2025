import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CalendarioDiaDetalleResponse, CalendarioMensualResponse } from '../model/calendario-operaciones.model';

@Injectable({
  providedIn: 'root'
})
export class CalendarioOperacionesService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.baseUrl}/operaciones/calendario`;

  getCalendarioMensual(params?: { year?: number | null; month?: number | null }): Observable<CalendarioMensualResponse> {
    let queryParams = new HttpParams();
    if (params?.year != null) {
      queryParams = queryParams.set('year', String(params.year));
    }
    if (params?.month != null) {
      queryParams = queryParams.set('month', String(params.month));
    }

    return this.http.get<CalendarioMensualResponse>(`${this.API}/mensual`, { params: queryParams });
  }

  getCalendarioDia(fecha: string): Observable<CalendarioDiaDetalleResponse> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get<CalendarioDiaDetalleResponse>(`${this.API}/dia`, { params });
  }
}
