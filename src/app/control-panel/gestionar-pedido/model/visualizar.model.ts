export class Proyecto {
  constructor(

    public Empleado : string,
    public N_Pedido : number,
    public Cliente : string,
    public F_Registro : string,
    public EstadoPedido : string,
    public Costo_Total : number,
    public Acuenta : number,
    public EstadoPago : string,
    public Evento : string,
    public Servicio : string,
    public F_Evento :string,
    public Hora_Evento : string,
    public  Direccion : string,
    public  Descripcion :string,
    public  NombrePedido : string,
    public  Ubicacion :string,
    public Latitud: null,
    public Longitud: null,
    public F_Evento2: string,
    public Hora_Evento2: string,
    public Direccion2: string,
    public Ubicacion2: string,
    public Latitud2: null,
    public Longitud2: null
   

 ){}
}
export class N_Pedido{
  constructor(
    public N_Pedido : number
    ){

  }
}

export class EditarPedido {
  constructor(

    public EP_Cod: number,
    public fecha: string,
    public hora: string,
    public ubicacion:string,
    public lugar: string,
    public latitud: string,
    public longitud: string,
    public fecha2: string,
    public hora2: string,
    public ubicacion2: string,
    public lugar2: string,
    public latitud2: string,
    public longitud2: string,
    public id: number


 ){}}

 export class AgregarPedido {
  constructor(
 
public NombrePedido:string,
public ExS :number,
public doc : string,
public fechaCreate : string,
public fechaEvent : string,
public horaEvent: string,
public CodEmp : number,
public Direccion : string,
public Observacion : string,

 ){}}

 export class EventServi2{
  constructor(
public ID : number,
public Evento : string,
public Servicio : string,
public Precio : number,
public Descripcion : string,
public Titulo : string,

  ){

  }
}
