export interface Cliente {
  idCliente: number;
  codigoCliente: string;
  nombre: string;
  apellido: string;
  correo: string;
  celular: string;
  doc: string;
  direccion: string;
  tipoDocumentoId?: number | null;
  tipoDocumentoCodigo?: string | null;
  tipoDocumentoNombre?: string | null;
  razonSocial?: string;
  idUsuario?: number;
  tipoCliente?: number;
  idEstadoCliente?: number;
  estadoCliente?: string;
  codigo?: string;
}

export interface ClienteUpdate {
  nombre?: string;
  apellido?: string;
  correo?: string;
  celular?: string;
  direccion?: string;
}

export interface EstadoCliente {
  idEstadoCliente: number;
  nombreEstadoCliente: string;
}
