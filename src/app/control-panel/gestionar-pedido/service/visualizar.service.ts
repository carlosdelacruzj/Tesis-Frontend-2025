import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AgregarPedido, EditarPedido, Proyecto } from '../model/visualizar.model';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class VisualizarService {
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
    CodEmp: 0, Direccion: '', Observacion: '',
  };

  // =========================
  // Endpoints (estandarizados)
  // =========================
  private readonly API_BASE = environment.baseUrl;                 // e.g. https://tp2021database.herokuapp.com
  private readonly API_PEDIDO = `${this.API_BASE}/pedido`;         // /pedido
  private readonly API_EVENTOS_SERV = `${this.API_BASE}/eventos_servicios`; // /eventos_servicios

  constructor(private http: HttpClient) {}

  // =========================
  // Pedidos
  // =========================

  /** Traer pedido por id */
  public getPedidoById(id: number | string): Observable<any> {
    return this.http.get<any>(`${this.API_PEDIDO}/${id}`);
  }

  /**
   * Actualizar pedido compuesto (PUT /pedido/:id)
   * Mantiene la firma que ya usas: updatePedido(id, data)
   */
  public updatePedido(id: number | string, data: any): Observable<any> {
    // Antes apuntabas a /pedido/actualiza/putByIdPedido (legacy). Ahora usamos /pedido/:id
    return this.http.put<any>(`${this.API_PEDIDO}/${id}`, data);
  }

  /**
   * Crear pedido compuesto (POST /pedido)
   * Mantiene tu firma postPedidos(data)
   */
  public postPedidos(data: any): Observable<any> {
    return this.http.post<any>(this.API_PEDIDO, data);
  }

  // =========================
  // Catálogo Evento-Servicio
  // =========================

  /**
   * Consulta de eventos por servicio (GET /eventos_servicios?evento=&servicio=)
   * Tipamos el retorno como any[] para no romper a quienes ya consumen sin modelo fuerte.
   */
  public getEventosServicio(evento?: number, servicio?: number): Observable<any[]> {
    let params = new HttpParams();
    if (evento != null) params = params.set('evento', String(evento));
    if (servicio != null) params = params.set('servicio', String(servicio));
    return this.http.get<any[]>(this.API_EVENTOS_SERV, { params });
  }
}
