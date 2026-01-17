import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AgregarPedido, EditarPedido, Proyecto } from '../model/visualizar.model';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class VisualizarService {
  private readonly http = inject(HttpClient);
  // =========================
  // Estado compartido (sin cambios)
  // =========================
  selectProyecto: Proyecto = {
    Empleado: '', N_Pedido: 0, Cliente: '', F_Registro: '', EstadoPedido: '',
    Costo_Total: 0, Acuenta: 0, EstadoPago: '', Evento: '', Servicio: '',
    F_Evento: '', Hora_Evento: '', Direccion: '', Descripcion: '', NombrePedido: '',
    Ubicacion: '', Latitud: null, Longitud: null,
    F_Evento2: '', Hora_Evento2: '', Direccion2: '', Ubicacion2: '', Latitud2: null, Longitud2: null
  };

  selectEditarPedido: EditarPedido = {
    EP_Cod: 0, fecha: '', hora: '', ubicacion: '', lugar: '', latitud: '', longitud: '',
    fecha2: '', hora2: '', ubicacion2: '', lugar2: '', latitud2: '', longitud2: '', id: 0
  };

  selectAgregarPedido: AgregarPedido = {
    NombrePedido: '', ExS: 0, doc: '', fechaCreate: '', fechaEvent: '', horaEvent: '',
    dias: null, CodEmp: 0, Direccion: '', Observacion: '',
  };

  // =========================
  // Endpoints (estandarizados)
  // =========================
  private readonly apiBase = environment.baseUrl;                 // e.g. https://tp2021database.herokuapp.com
  private readonly apiPedido = `${this.apiBase}/pedido`;         // /pedido
  private readonly apiEventosServ = `${this.apiBase}/eventos_servicios`; // /eventos_servicios

  // =========================
  // Pedidos
  // =========================

  /** Traer pedido por id */
  public getPedidoById(id: number | string): Observable<unknown> {
    return this.http.get<unknown>(`${this.apiPedido}/${id}`);
  }

  /**
   * Actualizar pedido compuesto (PUT /pedido/:id)
   * Mantiene la firma que ya usas: updatePedido(id, data)
   */
  public updatePedido(id: number | string, data: unknown): Observable<unknown> {
    // Antes apuntabas a /pedido/actualiza/putByIdPedido (legacy). Ahora usamos /pedido/:id
    return this.http.put<unknown>(`${this.apiPedido}/${id}`, data);
  }

  /**
   * Crear pedido compuesto (POST /pedido)
   * Mantiene tu firma postPedidos(data)
   */
  public postPedidos(data: unknown): Observable<unknown> {
    return this.http.post<unknown>(this.apiPedido, data);
  }

  // =========================
  // Catálogo Evento-Servicio
  // =========================

  /**
   * Consulta de eventos por servicio (GET /eventos_servicios?evento=&servicio=)
   * Tipamos el retorno como any[] para no romper a quienes ya consumen sin modelo fuerte.
   */
  public getEventosServicio(evento?: number, servicio?: number): Observable<unknown[]> {
    let params = new HttpParams();
    if (evento != null) params = params.set('evento', String(evento));
    if (servicio != null) params = params.set('servicio', String(servicio));
    return this.http.get<unknown[]>(this.apiEventosServ, { params });
  }
}
