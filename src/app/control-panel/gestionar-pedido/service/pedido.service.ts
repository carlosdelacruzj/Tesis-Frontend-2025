import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Proyecto, DatosCliente, Eventos, Servi } from '../model/pedido.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PedidoService {
  private readonly http = inject(HttpClient);
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

  private readonly apiBase = `${environment.baseUrl}/pedido`;
  // private API_PRUEBA =
  //   'https://tp2021database.herokuapp.com/pedido/consulta/getAllPedido';
  private readonly apiNumeroPedido =
    'https://tp2021database.herokuapp.com/pedido/consulta/getIndexPedido';

  private readonly apiDni =
    'https://tp2021database.herokuapp.com/cliente/consulta/getDataCliente/';
  private readonly apiClientes = `${environment.baseUrl}/clientes/by-doc`;

  private readonly apiServicios =`${environment.baseUrl}/servicios`;

  private readonly apiEventos =`${environment.baseUrl}/eventos`;

  // private API_SERVICIOSxEVENTOS =
  //   'https://tp2021database.herokuapp.com/eventos_servicios/consulta/getAllServiciosByEventoServ/';

  public getAllPedidos(): Observable<unknown> {
    return this.http.get(this.apiBase);
  }
  // public getDni(id: any): Observable<any> {
  //   return this.http.get(this.API_DNI + id)
  // }
    // GET /clientes/{id}
  public getDni(id: number | string): Observable<unknown> {
    return this.http.get(`${this.apiClientes}/${id}`);
  }
  public getN_Pedido(): Observable<unknown> {
    return this.http.get(this.apiNumeroPedido);
  }
  public getServicios(): Observable<unknown> {
    return this.http.get(this.apiServicios);
  }
  public getEventos(): Observable<unknown> {
    return this.http.get(this.apiEventos);
  }
  // public getEventServicios(): Observable<any> {
  //   return this.http.get(this.API_SERVICIOSxEVENTOS);
  // }

}
