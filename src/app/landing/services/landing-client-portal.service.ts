import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface ClienteCotizacion {
  idCotizacion: number;
  estado: string;
  fechaCreacion: string;
  idTipoEvento: number;
  tipoEvento: string;
  fechaEvento: string;
  lugar: string;
  horasEstimadas: string;
  mensaje: string;
  clienteId: number;
  clienteNombre: string;
  clienteApellido: string;
  clienteCorreo: string;
  clienteCelular: string;
  cantidadItems: number;
  total: string;
}

export interface ClientePedido {
  pedidoId: number;
  clienteId: number;
  fechaCreacion: string;
  nombrePedido: string;
  observaciones: string | null;
  cotizacionId: number | null;
  estadoPedido: string;
  estadoPago: string;
  empleadoId: number | null;
  empleadoNombre: string | null;
  subtotal: number;
  igv: number;
  total: number;
  montoAbonado: number;
  saldoPendiente: number;
  primerEventoFecha: string | null;
  ultimoEventoFecha: string | null;
  cantidadEventos: number;
  cantidadItems: number;
}

@Injectable({ providedIn: 'root' })
export class LandingClientPortalService {
  private readonly baseUrl = environment.baseUrl;

  private readonly http = inject(HttpClient);

  getCotizaciones(clienteId: number, estado?: string): Observable<ClienteCotizacion[]> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<ClienteCotizacion[]>(
      `${this.baseUrl}/clientes/${clienteId}/cotizaciones`,
      { params }
    );
  }

  getPedidos(clienteId: number): Observable<ClientePedido[]> {
    return this.http.get<ClientePedido[]>(`${this.baseUrl}/clientes/${clienteId}/pedidos`);
  }
}
