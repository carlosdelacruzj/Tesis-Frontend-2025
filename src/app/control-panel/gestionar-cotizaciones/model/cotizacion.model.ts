export interface CotizacionLead {
  id?: number;
  nombre?: string;
  celular?: string;
  origen?: string;
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
}

export interface CotizacionPayload {
  clienteId?: number;
  clienteNombre?: string;
  clienteContacto?: string;
  fechaEvento: string;
  horaEvento?: string;
  horasEstimadas?: string;
  ubicacion?: string;
  direccionExacta?: string;
  descripcion: string;
  servicioId?: number;
  servicioNombre?: string;
  eventoId?: number;
  eventoNombre?: string;
  totalEstimado?: number;
  estado?: string;
  observaciones?: string;
  items?: CotizacionItemPayload[];
}

export interface CotizacionItemPayload {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  notas?: string;
}

export interface CotizacionUpdatePayload extends Partial<CotizacionPayload> {}
