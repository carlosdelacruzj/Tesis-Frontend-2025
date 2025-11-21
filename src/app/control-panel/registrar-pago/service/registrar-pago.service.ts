import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { MetodoPago } from '../model/metodopago.model';

export interface PedidoLite {
  IdPed: number;
  Nombre: string;
  Fecha: string; // ISO
}
export interface ResumenPago {
  CostoTotal: number;
  MontoAbonado: number;
  SaldoPendiente: number;
}

export interface VoucherVM {
  Codigo: number | string;
  Fecha: string;
  Monto: number;
  MetodoPago: string;
  Link: string;
}

@Injectable({ providedIn: 'root' })
export class RegistrarPagoService {
  private readonly API = environment.baseUrl;

  constructor(private http: HttpClient) { }

  // === Tabs por estado de pago ===
  getPedidosPendientes(): Observable<PedidoLite[]> {
    return this.http.get<PedidoLite[]>(`${this.API}/pagos/pendientes`);
  }
  getPedidosParciales(): Observable<PedidoLite[]> {
    return this.http.get<PedidoLite[]>(`${this.API}/pagos/parciales`);
  }
  getPedidosPagados(): Observable<PedidoLite[]> {
    return this.http.get<PedidoLite[]>(`${this.API}/pagos/pagados`);
  }

  // === Resumen y vouchers del pedido ===
  getResumenPedido(id: number): Observable<ResumenPago> {
    return this.http.get<ResumenPago>(`${this.API}/pagos/resumen/${id}`);
  }
  // registrar-pago.service.ts
  getVouchersPedido(id: number): Observable<VoucherVM[]> {
    return this.http.get<VoucherVM[]>(`${this.API}/pagos/vouchers/${id}`).pipe(
      // añade la URL directa de la imagen
      map(vs => vs.map(v => ({
        ...v,
        Link: `${this.API}/pagos/${v.Codigo}/imagen`
      })))
    );
  }

  getVoucherImageBlob(idVoucher: number) {
    return this.http.get(`${this.API}/pagos/${idVoucher}/imagen`, {
      responseType: 'blob'
    });
  }

  // === Métodos de pago ===
  getMetodosPago(): Observable<MetodoPago[]> {
    return this.http.get<MetodoPago[]>(`${this.API}/pagos/metodos`);
  }

  // === Registrar pago (multipart) ===
  postPago(params: {
    file?: File;
    monto: number;
    pedidoId: number;
    metodoPagoId: number;
    estadoVoucherId?: number; // default 2 = Aprobado
    fecha?: string;
  }): Promise<any> {
    const fd = new FormData();

    // ⬇️ Adjunta file SOLO si viene
    if (params.file) {
      fd.append('file', params.file, params.file.name);
    }

    fd.append('monto', String(params.monto));
    fd.append('pedidoId', String(params.pedidoId));
    fd.append('metodoPagoId', String(params.metodoPagoId));
    if (params.estadoVoucherId != null) fd.append('estadoVoucherId', String(params.estadoVoucherId));
    if (params.fecha) fd.append('fecha', params.fecha);

    // Importante: NO seteas Content-Type; deja que el browser ponga el boundary del multipart
    return this.http.post(`${this.API}/pagos`, fd).toPromise();
  }

  crearProyecto(payload: {
    proyectoNombre: string;
    pedidoId: number;
    fechaInicioEdicion?: string;
    fechaFinEdicion?: string;
    estadoId?: number;
    responsableId?: number;
    notas?: string;
    enlace?: string;
  }): Promise<any> {
    return this.http.post(`${this.API}/proyecto`, payload).toPromise();
  }


}
