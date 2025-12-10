export interface Cliente {
  idCliente: number;
  codigoCliente: string;
  nombre: string;
  apellido: string;
  correo: string;
  celular: string;
  doc: string;
  direccion: string;
  idUsuario?: number;
  tipoCliente?: number;
  estadoCliente?: string;
  codigo?: string;
}

export interface ClienteUpdate {
  correo?: string;
  celular?: string;
  direccion?: string;
}

export interface EstadoCliente {
  idEstadoCliente: number;
  nombreEstadoCliente: string;
}
