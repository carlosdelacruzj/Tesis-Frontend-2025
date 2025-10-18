export interface CotizacionLead {
  id?: number;
  nombre?: string;
  celular?: string;
  origen?: string;
  correo?: string;
  fechaCreacion?: string;
}

export interface CotizacionApiLead {
  id?: number | string | null;
  idlead?: number | string | null;
  ID?: number | string | null;
  nombre?: string | null;
  Nombre?: string | null;
  celular?: string | null;
  Celular?: string | null;
  origen?: string | null;
  Origen?: string | null;
  correo?: string | null;
  Correo?: string | null;
  fechaCreacion?: string | null;
  fechaCrea?: string | null;
  [key: string]: unknown;
}

export interface Cotizacion {
  id: number;
  codigo?: string;
  cliente?: string;
  contacto?: string;
  servicio?: string;
  evento?: string;
  fecha?: string;
  hora?: string;
  horasEstimadas?: string;
  estado?: string;
  total?: number;
  notas?: string;
  pdfUrl?: string;
  items?: CotizacionItemPayload[];
  raw?: unknown;
  lugar?: string;
  createdAt?: string;
  lead?: CotizacionLead;
  eventoSolicitado?: string;
  servicioId?: number;
  eventoId?: number;
}

export interface CotizacionLeadPayload {
  id?: number;
  nombre?: string;
  celular?: string;
  origen?: string;
  correo?: string;
}

export interface CotizacionDetallePayload {
  idCotizacion?: number;
  eventoId?: number;
  idTipoEvento?: number;
  tipoEvento?: string;
  fechaEvento: string;
  lugar?: string;
  horasEstimadas?: number;
  mensaje?: string;
  estado?: string;
  totalEstimado?: number;
}

export interface CotizacionApiResponse {
  id?: number | string | null;
  idCotizacion?: number | string | null;
  estado?: string | null;
  fechaCreacion?: string | null;
  fecha_creacion?: string | null;
  eventoId?: number | string | null;
  idEvento?: number | string | null;
  idTipoEvento?: number | string | null;
  tipoEvento?: string | null;
  evento?: string | null;
  fechaEvento?: string | null;
  fecha_evento?: string | null;
  lugar?: string | null;
  horasEstimadas?: string | number | null;
  horas_estimadas?: string | number | null;
  mensaje?: string | null;
  notas?: string | null;
  total?: number | string | null;
  totalEstimado?: number | string | null;
  lead?: CotizacionApiLead | null;
  contacto?: CotizacionApiLead | null;
  cotizacion?: (Partial<CotizacionDetallePayload> & {
    horasEstimadas?: number | string | null;
    totalEstimado?: number | string | null;
    total?: number | string | null;
    fechaEvento?: string | null;
    fechaCreacion?: string | null;
    estado?: string | null;
    idTipoEvento?: number | string | null;
    items?: Array<Record<string, unknown>> | null;
  }) | null;
  items?: Array<Record<string, unknown>> | null;
}

export interface CotizacionItemPayload {
  idEventoServicio?: number;
  grupo?: string | null;
  opcion?: number | null;
  titulo: string;
  descripcion?: string;
  moneda?: string;
  precioUnitario: number;
  cantidad: number;
  descuento?: number;
  recargo?: number;
  notas?: string;
  horas?: number | null;
  personal?: number | null;
  fotosImpresas?: number | null;
  trailerMin?: number | null;
  filmMin?: number | null;
}

export interface CotizacionContextoPayload {
  clienteId?: number;
  servicioId?: number;
  servicioNombre?: string;
  eventoNombre?: string;
  horaEvento?: string;
  horasEstimadasTexto?: string;
}

export interface CotizacionPayload {
  lead: CotizacionLeadPayload;
  cotizacion: CotizacionDetallePayload;
  items: CotizacionItemPayload[];
  contexto?: CotizacionContextoPayload;
}

export interface CotizacionUpdatePayload extends Partial<CotizacionPayload> {}

export interface ClienteBusquedaResultado {
  [key: string]: unknown;
  id?: number | string | null;
  nombre?: string | null;
  nombreCompleto?: string | null;
  correo?: string | null;
  email?: string | null;
  celular?: string | null;
  telefono?: string | null;
  contacto?: string | null;
  identificador?: string | null;
  direccion?: string | null;
  codigo?: string | null;
  idCliente?: number | null;
  codigoCliente?: string | null;
  doc?: string | null;
  apellido?: string | null;
  ruc?: string | null;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
}

export interface CotizacionPublicPayload {
  lead: CotizacionLeadPayload;
  cotizacion: CotizacionDetallePayload;
}

export interface CotizacionPublicResponse {
  lead_id?: number | string | null;
  cotizacion_id?: number | string | null;
}

export interface CotizacionPublicResult {
  leadId: number | null;
  cotizacionId: number | null;
}
