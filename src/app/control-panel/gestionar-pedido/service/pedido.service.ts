import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Proyecto, DatosCliente, Eventos, Servi } from '../model/pedido.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PedidoService {
  selectProyecto: Proyecto = {

    ID: 0,
    Nombre: '',
    Fecha: '',
    Servicio: '',
    Evento: '',
    Cliente: '',
    Estado: '',
  };
  selectCliente: DatosCliente = {


    Nombre: '',
    Apellido: '',
    Cod_Cli: 0

  };

  selectServicios: Servi = {

    ID: 0,
    Nombre: ''
  };

  selectEventos: Eventos = {

    PK_E_Cod: 0,
    E_Nombre: ''

  };


  // selectEventosxServicios: EventServi = {
  //   ID: 0,
  //   Evento: '',
  //   Servicio: '',
  //   Precio: 0,
  //   Descripcion: '',
  //   Titulo: '',
  // };

  private API_PRUEBA = `${environment.baseUrl}/pedido`;
  // private API_PRUEBA =
  //   'https://tp2021database.herokuapp.com/pedido/consulta/getAllPedido';
  private API_N_Pedido =
    'https://tp2021database.herokuapp.com/pedido/consulta/getIndexPedido';

  private API_DNI =
    'https://tp2021database.herokuapp.com/cliente/consulta/getDataCliente/';
  private API_CLIENTES = `${environment.baseUrl}/clientes/by-doc`;

  private API_SERVICIOS =`${environment.baseUrl}/servicios`;

  private API_EVENTOS =`${environment.baseUrl}/eventos`;

  // private API_SERVICIOSxEVENTOS =
  //   'https://tp2021database.herokuapp.com/eventos_servicios/consulta/getAllServiciosByEventoServ/';

  constructor(private http: HttpClient) { }


  public getAllPedidos(): Observable<any> {
    return this.http.get(this.API_PRUEBA);
  }
  // public getDni(id: any): Observable<any> {
  //   return this.http.get(this.API_DNI + id)
  // }
    // GET /clientes/{id}
  public getDni(id: number | string): Observable<any> {
    return this.http.get(`${this.API_CLIENTES}/${id}`);
  }
  public getN_Pedido(): Observable<any> {
    return this.http.get(this.API_N_Pedido);
  }
  public getServicios(): Observable<any> {
    return this.http.get(this.API_SERVICIOS);
  }
  public getEventos(): Observable<any> {
    return this.http.get(this.API_EVENTOS);
  }
  // public getEventServicios(): Observable<any> {
  //   return this.http.get(this.API_SERVICIOSxEVENTOS);
  // }

}
