import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from 'src/environments/environment';

export interface LandingLeadDto {
  nombre: string;
  celular: string;
  origen: string;
}

export interface LandingCotizacionDto {
  tipoServicio: string;
  fechaEvento: string;
  lugar: string;
  horasEstimadas: number | null;
  mensaje: string;
  estado: string;
}

export interface LandingCreateCotizacionDto {
  lead: LandingLeadDto;
  cotizacion: LandingCotizacionDto;
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

  create(payload: LandingCreateCotizacionDto): Observable<any> {
    console.log('[LandingCotizacionService] POST /cotizaciones', payload);
    return this.http.post(this.baseUrl, payload);
  }

  update(id: number | string, payload: any): Observable<any> {
    console.log('[LandingCotizacionService] PUT /cotizaciones/' + id, payload);
    return this.http.put(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number | string): Observable<any> {
    console.log('[LandingCotizacionService] DELETE /cotizaciones/' + id);
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
