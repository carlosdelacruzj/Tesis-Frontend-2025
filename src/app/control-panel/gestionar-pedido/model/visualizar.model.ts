export interface Proyecto {
  Empleado: string;
  N_Pedido: number;
  Cliente: string;
  F_Registro: string;
  EstadoPedido: string;
  Costo_Total: number;
  Acuenta: number;
  EstadoPago: string;
  Evento: string;
  Servicio: string;
  F_Evento: string;
  Hora_Evento: string;
  Direccion: string;
  Descripcion: string;
  NombrePedido: string;
  Ubicacion: string;
  Latitud: null;
  Longitud: null;
  F_Evento2: string;
  Hora_Evento2: string;
  Direccion2: string;
  Ubicacion2: string;
  Latitud2: null;
  Longitud2: null;
}

export interface N_Pedido {
  N_Pedido: number;
}

export interface EditarPedido {
  EP_Cod: number;
  fecha: string;
  hora: string;
  ubicacion: string;
  lugar: string;
  latitud: string;
  longitud: string;
  fecha2: string;
  hora2: string;
  ubicacion2: string;
  lugar2: string;
  latitud2: string;
  longitud2: string;
  id: number;
}

export interface AgregarPedido {
  NombrePedido: string;
  ExS: number;
  doc: string;
  fechaCreate: string;
  fechaEvent: string;
  horaEvent: string;
  dias: number | null;
  CodEmp: number;
  horasEstimadas: number | null;
  Direccion: string;
  Observacion: string;
  mensaje?: string;
  departamento?: string;
  viaticosCliente?: boolean;
  viaticosMonto?: number | null;
}

export interface EventServi2 {
  ID: number;
  Evento: string;
  Servicio: string;
  Precio: number;
  Descripcion: string;
  Titulo: string;
}

export interface PedidoCliente {
  id: number;
  documento: string;
  razonSocial: string | null;
  nombres: string;
  apellidos: string;
  celular: string;
  correo: string;
  direccion: string;
}

export interface PedidoEmpleado {
  nombres: string;
  apellidos: string;
}

export interface PedidoDetalle {
  id: number;
  codigo: string;
  clienteId: number;
  cotizacionId: number | null;
  contratoVigenteId?: number | null;
  contratoVersionVigente?: number | string | null;
  contratoEstadoVigente?: string | null;
  nombrePedido: string;
  empleadoId: number;
  fechaCreacion: string;
  fechaEvento: string | null;
  estadoPedidoId: number;
  estadoPagoId: number;
  observaciones: string;
  idTipoEvento: number;
  lugar: string;
  dias: number;
  horasEstimadas: number | null;
  viaticosMonto: number | null;
  viaticosCliente?: boolean;
  mensaje: string;
  subtotal: number;
  igv: number;
  total: number;
  cliente: PedidoCliente;
  empleado: PedidoEmpleado;
}

export interface PedidoEvento {
  id: number;
  pedidoId: number;
  fecha: string;
  hora: string;
  ubicacion: string;
  direccion: string;
  notas: string;
}

export interface PedidoItem {
  id: number;
  pedidoId: number;
  eventoCodigo: string | number | null;
  idEventoServicio: number | null;
  eventoId: number | null;
  servicioId: number | null;
  nombre: string;
  descripcion: string;
  moneda: string;
  precioUnit: number;
  cantidad: number;
  descuento: number;
  recargo: number;
  notas: string;
  horas: number | null;
  personal: number | null;
  fotosImpresas: number | null;
  trailerMin: number | null;
  filmMin: number | null;
  subtotal: number;
}

export interface PedidoServicioFecha {
  idPedidoServicio: number;
  fecha: string;
}

export interface PedidoResponse {
  pedido: PedidoDetalle;
  eventos: PedidoEvento[];
  items: PedidoItem[];
  serviciosFechas: PedidoServicioFecha[];
}

export interface PedidoUpdateDetalle {
  empleadoId: number;
  fechaCreacion: string;
  estadoPedidoId: number;
  fechaEvento: string | null;
  lugar: string;
  observaciones: string;
  idTipoEvento: number;
  dias: number;
  horasEstimadas: number | null;
  viaticosMonto: number;
  viaticosCliente: boolean;
  mensaje: string;
  nombrePedido: string;
  cotizacionId: number | null;
  clienteId: number;
  cliente: { documento: string };
}

export interface PedidoUpdateEvento {
  id: number | null;
  clientEventKey?: number | null;
  fecha: string;
  hora: string;
  ubicacion: string;
  direccion: string;
  notas: string;
}

export interface PedidoUpdateItem {
  id: number | null;
  exsId?: number | null;
  idEventoServicio: number | null;
  tmpId?: string | null;
  eventoId: number | null;
  servicioId: number | null;
  eventoCodigo: string | number | null;
  moneda: string;
  nombre: string;
  descripcion: string;
  precioUnit: number;
  cantidad: number;
  descuento: number;
  recargo: number;
  horas: number | null;
  personal: number | null;
  fotosImpresas: number | null;
  trailerMin: number | null;
  filmMin: number | null;
  notas: string;
}

export interface PedidoUpdateServicioFecha {
  idPedidoServicio?: number;
  itemTmpId?: string;
  fecha: string;
}

export interface PedidoUpdatePayload {
  pedido: PedidoUpdateDetalle;
  eventos: PedidoUpdateEvento[];
  items: PedidoUpdateItem[];
  serviciosFechas: PedidoUpdateServicioFecha[];
}

export interface PedidoCreateDetalle {
  empleadoId: number;
  fechaCreacion: string;
  estadoPedidoId: number;
}

export interface PedidoCreateEvento {
  fecha: string;
  hora: string;
  ubicacion: string;
  direccion: string;
  notas: string;
}

export interface PedidoCreateItem {
  idEventoServicio: number | null;
  eventoCodigo: string | number | null;
  moneda: string;
  nombre: string;
  descripcion: string;
  precioUnit: number;
  cantidad: number;
  descuento: number;
  recargo: number;
  notas: string;
}

export interface PedidoCreatePayload {
  pedido: PedidoCreateDetalle;
  eventos: PedidoCreateEvento[];
  items: PedidoCreateItem[];
}
