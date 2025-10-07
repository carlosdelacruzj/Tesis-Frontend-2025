import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface RelEventoServicio {
  ID: number;
  Evento?: number | string;
  Servicio?: number | string;
  Precio?: number | string;
  Descripcion?: string;
  Titulo?: string;
}

@Injectable({ providedIn: 'root' })
export class EventoServicioService {
  private base = environment.baseUrl;

  // Tu comp asigna aquí un objeto 'servicio' que a veces trae Servicio:number
  selectProyecto: RelEventoServicio = {
    ID: 0,
    Evento: '',
    Servicio: '',
    Precio: 0,
    Descripcion: '',
    Titulo: ''
  };

  constructor(private http: HttpClient) {}

  getAllNombres2(): Observable<any> {
    return this.http.get(`${this.base}/eventos_servicios`);
  }

  api(eventoId: number): Observable<any> {
    return this.http.get(`${this.base}/eventos_servicios`, {
      params: { evento: String(eventoId) }
    });
  }
}
