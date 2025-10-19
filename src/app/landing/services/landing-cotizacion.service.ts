import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';

export interface LandingLeadDto {
  nombre: string;
  celular: string;
  origen: string;
}

export interface LandingPublicCotizacionPayload {
  lead: LandingLeadDto;
  cotizacion: {
    idTipoEvento?: number | null;
    tipoEvento: string;
    fechaEvento: string;
    lugar?: string;
    horasEstimadas?: number | null;
    mensaje?: string;
  };
}

export interface LandingEventDto {
  PK_E_Cod: number;
  E_Nombre: string;
}

@Injectable({ providedIn: 'root' })
export class LandingCotizacionService {
  private readonly baseUrl = `${environment.baseUrl}/cotizaciones`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<any> {
    return this.http.get(this.baseUrl);
  }

  getById(id: number | string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${id}`);
  }

  createPublic(payload: LandingPublicCotizacionPayload): Observable<any> {
    console.log('[LandingCotizacionService] POST /cotizaciones/public', payload);
    return this.http.post(`${this.baseUrl}/public`, payload);
  }

  update(id: number | string, payload: any): Observable<any> {
    console.log('[LandingCotizacionService] PUT /cotizaciones/' + id, payload);
    return this.http.put(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number | string): Observable<any> {
    console.log('[LandingCotizacionService] DELETE /cotizaciones/' + id);
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  getEventos(): Observable<LandingEventDto[]> {
    const url = `${environment.baseUrl}/eventos`;
    console.log('[LandingCotizacionService] GET', url);
    return this.http.get<LandingEventDto[]>(url);
  }
}
