export class Proyecto {
  constructor(

    public ID: number,
    public Nombre: string,
    public Fecha: string,
    public Servicio: string,
    public Evento: string,
    public Cliente: string,
    public Estado: string,

  ) { }
}
export class DatosCliente {
  constructor(
    public Nombre: string,
    public Apellido: string,
    public Cod_Cli: number
  ) {

  }
}
export class Servi {
  constructor(
    public ID: number,
    public Nombre: string
  ) {

  }
}

export class Eventos {
  constructor(

    public PK_E_Cod: number,
    public E_Nombre: string

  ) {

  }
}
// export class EventServi{
//   constructor(
// public ID : number,
// public Evento : string,
// public Servicio : String,
// public Precio : number,
// public Descripcion : String,
// public Titulo : String,

//   ){

//   }
// }
