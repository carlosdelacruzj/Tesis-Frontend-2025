export interface CotizacionLead {
  id?: number;
  nombre?: string;
  celular?: string;
  origen?: string;
  correo?: string;
  fechaCreacion?: string;
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
