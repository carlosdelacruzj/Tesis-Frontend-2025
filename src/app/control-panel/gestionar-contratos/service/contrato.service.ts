import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ContratoGestionRow,
  ContratoListQuery,
  ContratoVersionResumen,
} from '../model/contrato.model';

@Injectable({ providedIn: 'root' })
export class ContratoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.baseUrl}/contratos`;

  getContratos(query?: ContratoListQuery): Observable<ContratoGestionRow[]> {
    let params = new HttpParams();
    if (query?.estado) {
      params = params.set('estado', query.estado);
    }
    if (query?.vigente != null) {
      params = params.set('vigente', query.vigente ? 'true' : 'false');
    }
    if (query?.q) {
      params = params.set('q', query.q);
    }
    return this.http.get<ContratoGestionRow[]>(this.api, { params });
  }

  getContratoPdf(id: number, regenerate = false): Observable<Blob> {
    let params = new HttpParams();
    if (regenerate) {
      params = params.set('regenerate', '1');
    }
    return this.http.get(`${this.api}/${id}/pdf`, { params, responseType: 'blob' });
  }

  getHistorialByPedido(pedidoId: number): Observable<ContratoVersionResumen[]> {
    return this.http.get<ContratoVersionResumen[]>(`${this.api}/pedido/${pedidoId}`);
  }

  getVigenteByPedido(pedidoId: number): Observable<ContratoVersionResumen> {
    return this.http.get<ContratoVersionResumen>(`${this.api}/pedido/${pedidoId}/vigente`);
  }
}
