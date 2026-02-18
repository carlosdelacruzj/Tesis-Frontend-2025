import { Injectable, inject } from '@angular/core';
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
    diasEvento?: number | null;
    horasEstimadas?: number | null;
    mensaje?: string;
  };
}

export interface LandingEventDto {
  PK_E_Cod?: number;
  E_Nombre?: string;
  id?: number;
  nombre?: string;
  iconUrl?: string | null;
  formSchema?: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    active: boolean;
    order: number;
    placeholder?: string | null;
    helpText?: string | null;
    options?: string[];
  }>;
}

@Injectable({ providedIn: 'root' })
export class LandingCotizacionService {
  private readonly baseUrl = `${environment.baseUrl}/cotizaciones`;

  private readonly http = inject(HttpClient);

  list(): Observable<unknown> {
    return this.http.get<unknown>(this.baseUrl);
  }

  getById(id: number | string): Observable<unknown> {
    return this.http.get<unknown>(`${this.baseUrl}/${id}`);
  }

  createPublic(payload: LandingPublicCotizacionPayload): Observable<unknown> {
    return this.http.post<unknown>(`${this.baseUrl}/public`, payload);
  }

  update(id: number | string, payload: Record<string, unknown>): Observable<unknown> {
    return this.http.put<unknown>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number | string): Observable<unknown> {
    return this.http.delete<unknown>(`${this.baseUrl}/${id}`);
  }

  getEventos(): Observable<LandingEventDto[]> {
    const url = `${environment.baseUrl}/eventos`;
    return this.http.get<LandingEventDto[]>(url);
  }
}
