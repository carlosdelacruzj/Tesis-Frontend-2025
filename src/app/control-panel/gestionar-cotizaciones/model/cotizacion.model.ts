export interface CotizacionContacto {
  id?: number;
  nombre?: string;
  celular?: string;
  origen?: string;
  correo?: string;
  fechaCreacion?: string;
}

export interface CotizacionApiContacto {
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
  contactoResumen?: string;
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
  eventos?: CotizacionEventoPayload[];
  raw?: unknown;
  lugar?: string;
  createdAt?: string;
  contacto?: CotizacionContacto;
  eventoSolicitado?: string;
  servicioId?: number;
  eventoId?: number;
  cotizacionVersionVigenteId?: number | null;
  cotizacionVersionVigente?: number | string | null;
  cotizacionVersionEstadoVigente?: string | null;
}

export interface CotizacionContactoPayload {
  id?: number;
  nombre?: string;
  celular?: string;
  origen?: string;
  correo?: string;
  fechaCreacion?: string;
}

export interface CotizacionDetallePayload {
  idCotizacion?: number;
  eventoId?: number;
  idTipoEvento?: number;
  tipoEvento?: string;
  fechaEvento: string;
  lugar?: string;
  dias?: number;
  horasEstimadas?: number;
  mensaje?: string;
  estado?: string;
  totalEstimado?: number;
  viaticosCliente?: boolean;
  viaticosMonto?: number | null;
}

export interface CotizacionApiResponse {
  id?: number | string | null;
  idCotizacion?: number | string | null;
  cotizacionVersionVigenteId?: number | string | null;
  cotizacionVersionVigente?: number | string | null;
  cotizacionVersionEstadoVigente?: string | null;
  estado?: string | null;
  fechaCreacion?: string | null;
  fecha_creacion?: string | null;
  codigo?: string | null;
  codigoCotizacion?: string | null;
  eventoId?: number | string | null;
  idEvento?: number | string | null;
  idTipoEvento?: number | string | null;
  tipoEvento?: string | null;
  evento?: string | null;
  fechaEvento?: string | null;
  fecha_evento?: string | null;
  lugar?: string | null;
  dias?: string | number | null;
  horasEstimadas?: string | number | null;
  horas_estimadas?: string | number | null;
  mensaje?: string | null;
  notas?: string | null;
  total?: number | string | null;
  totalEstimado?: number | string | null;
  viaticosMonto?: number | string | null;
  viaticos_monto?: number | string | null;
  viaticosCliente?: boolean | null;
  viaticos_cliente?: boolean | null;
  lead?: CotizacionApiContacto | null;
  contacto?: CotizacionApiContacto | null;
  cotizacion?: (Partial<CotizacionDetallePayload> & {
    horasEstimadas?: number | string | null;
    totalEstimado?: number | string | null;
    total?: number | string | null;
    fechaEvento?: string | null;
    fechaCreacion?: string | null;
    estado?: string | null;
    idTipoEvento?: number | string | null;
    items?: Record<string, unknown>[] | null;
    serviciosFechas?: Record<string, unknown>[] | null;
  }) | null;
  items?: Record<string, unknown>[] | null;
  eventos?: Record<string, unknown>[] | null;
  serviciosFechas?: Record<string, unknown>[] | null;
}

export interface CotizacionItemPayload {
  idEventoServicio?: number;
  idCotizacionServicio?: number;
  eventoId?: number;
  servicioId?: number;
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

export interface CotizacionEventoPayload {
  id?: number;
  fecha?: string;
  hora?: string;
  ubicacion?: string;
  direccion?: string;
  notas?: string;
  esPrincipal?: boolean;
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
  contacto: CotizacionContactoPayload;
  cotizacion: CotizacionDetallePayload;
  items: CotizacionItemPayload[];
  eventos?: CotizacionEventoPayload[];
  contexto?: CotizacionContextoPayload;
  serviciosFechas?: Record<string, unknown>[];
}

export interface CotizacionAdminClientePayload {
  id: number;
}

export interface CotizacionAdminLeadPayload {
  nombre?: string;
  celular?: string;
  origen?: string;
  correo?: string;
}

export interface CotizacionAdminItemPayload {
  tmpId?: string;
  idEventoServicio?: number;
  eventoId?: number;
  servicioId?: number;
  titulo: string;
  descripcion?: string;
  moneda?: string;
  precioUnitario: number;
  cantidad: number;
  notas?: string;
  horas?: number;
  personal?: number;
  fotosImpresas?: number;
  trailerMin?: number;
  filmMin?: number;
}

export interface CotizacionAdminServicioFechaPayload {
  itemTmpId: string;
  fecha: string;
}

export interface CotizacionAdminEventoPayload {
  fecha?: string;
  hora?: string;
  ubicacion?: string;
  direccion?: string;
  notas?: string | null;
}

export interface CotizacionAdminBasePayload {
  cotizacion: {
    idTipoEvento?: number | null;
    tipoEvento?: string;
    fechaEvento?: string;
    lugar?: string;
    dias?: number | null;
    horasEstimadas?: number | null;
    mensaje?: string;
    estado?: string;
    viaticosCliente?: boolean;
    viaticosMonto?: number | null;
  };
  items: CotizacionAdminItemPayload[];
  serviciosFechas?: CotizacionAdminServicioFechaPayload[];
  eventos?: CotizacionAdminEventoPayload[];
  cliente?: CotizacionAdminClientePayload;
}

export interface CotizacionAdminCreatePayload extends CotizacionAdminBasePayload {
  lead?: CotizacionAdminLeadPayload;
}

export type CotizacionAdminUpdatePayload = CotizacionAdminBasePayload;

export type CotizacionUpdatePayload = CotizacionAdminUpdatePayload;

export interface LeadConvertPayload {
  correo: string;
  celular: string;
  nombre: string;
  apellido: string;
  numDoc: string;
  tipoDocumentoId?: number | null;
  razonSocial?: string | null;
  direccion: string;
}

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
  contacto: CotizacionContactoPayload;
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

export interface CotizacionPedidoPayload {
  empleadoId: number | string;
  nombrePedido?: string | null;
}

export interface CotizacionPedidoResponse {
  pedidoId: number;
}

export interface PedidoDisponibilidadDiariaResumenItem {
  total: number;
  reservado: number;
  disponible: number;
}

export interface PedidoDisponibilidadDiariaResumenDesglose {
  interno?: PedidoDisponibilidadDiariaResumenItem;
  freelance?: PedidoDisponibilidadDiariaResumenItem;
}

export interface PedidoDisponibilidadDiariaResumen {
  personal: PedidoDisponibilidadDiariaResumenItem & PedidoDisponibilidadDiariaResumenDesglose;
  equipos: PedidoDisponibilidadDiariaResumenItem;
}

export interface PedidoDisponibilidadDiariaPersonalRol {
  rolId: number;
  rolNombre: string;
  total: number;
  reservado: number;
  disponible: number;
  interno?: PedidoDisponibilidadDiariaResumenItem;
  freelance?: PedidoDisponibilidadDiariaResumenItem;
}

export interface PedidoDisponibilidadDiariaEquipoTipo {
  tipoEquipoId: number;
  tipoEquipoNombre: string;
  total: number;
  reservado: number;
  disponible: number;
}

export interface PedidoDisponibilidadDiariaRiesgos {
  personalCriticoInterno?: string;
  equiposCriticosInternos?: string;
  equiposSecundariosInternos?: string;
}

export interface PedidoDisponibilidadDia {
  nivel?: 'ALTA' | 'LIMITADA' | 'CRITICA' | string;
  requiereApoyoExterno?: boolean;
  motivos?: string[];
  riesgos?: PedidoDisponibilidadDiariaRiesgos;
}

export interface PedidoDisponibilidadDiariaResponse {
  fecha: string;
  resumen: PedidoDisponibilidadDiariaResumen;
  personalPorRol: PedidoDisponibilidadDiariaPersonalRol[];
  equiposPorTipo: PedidoDisponibilidadDiariaEquipoTipo[];
  disponibilidadDia?: PedidoDisponibilidadDia;
}

export interface CotizacionVersionSnapshot {
  estadoCotizacion: string;
  cotizacion: Record<string, unknown>;
  contacto: Record<string, unknown>;
  eventos: Record<string, unknown>[];
  items: Record<string, unknown>[];
  serviciosFechas: Record<string, unknown>[];
  templateData: Record<string, unknown>;
}

export interface CotizacionVersion {
  id: number;
  cotizacionId: number;
  version: number;
  estado: string;
  snapshotHash: string;
  esVigente: boolean;
  fechaCreacion: string;
  fechaCierre: string | null;
  pdfLink: string | null;
  snapshot: CotizacionVersionSnapshot;
}

export type CotizacionVersionesResponse = CotizacionVersion[];
export type CotizacionVersionVigenteResponse = CotizacionVersion;
export type CotizacionVersionDetalleResponse = CotizacionVersion;

export interface CotizacionVersionErrorResponse {
  message: string;
}
