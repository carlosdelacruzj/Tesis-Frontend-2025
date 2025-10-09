import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Paquete {
  PK_E_Cod: number;
  E_Nombre: string;
  E_Enlace: string;
}

@Injectable({ providedIn: 'root' })
export class PaqueteServicioService {
  private base = environment.baseUrl;

  selectProyecto: Paquete = { PK_E_Cod: 0, E_Nombre: '', E_Enlace: '' };

  constructor(private http: HttpClient) {}

  getAllNombres(): Observable<any> {
    return this.http.get(`${this.base}/eventos`);
  }

    // 🔹 NUEVO: crear evento
  createEvento(nombre: string): Observable<any> {
    return this.http.post<any>(this.base, { nombre });
  }

}
