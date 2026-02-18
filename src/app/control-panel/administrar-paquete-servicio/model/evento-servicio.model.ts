export interface Evento {
  id: number;
  nombre: string;
  formSchema?: EventoFormSchemaField[];
  /**
   * URL del icono representativo. Se mantiene opcional mientras se evalúa su deprecación.
   */
  iconUrl?: string | null;
}

export interface EventoFormSchemaField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  active: boolean;
  order: number;
  placeholder?: string | null;
  helpText?: string | null;
  options?: string[];
}

export interface EventoSchemaResponse {
  eventoId: number;
  formSchema: EventoFormSchemaField[];
}

export interface EventoSchemaUpdatePayload {
  formSchema: EventoFormSchemaField[];
}

export interface EventoSchemaUpdateResponse {
  Status: string;
  eventoId: number;
  formSchema: EventoFormSchemaField[];
}

export interface EventoUpsertResponse {
  Status: string;
}

export interface EventoCreatePayload {
  nombre: string;
  icon?: File | null;
  iconUrl?: string | null;
  formSchema?: EventoFormSchemaField[] | null;
}

export interface EventoUpdatePayload {
  nombre?: string;
  icon?: File | null;
  iconUrl?: string | null;
  formSchema?: EventoFormSchemaField[] | null;
}

export interface Servicio {
  id: number;
  nombre: string;
}

export interface EstadoEventoServicio {
  idEstado: number;
  nombreEstado: string;
}

export interface EventoServicioStaff {
  rol: string;
  cantidad: number;
}

export interface EventoServicioEquipo {
  tipoEquipoId: number;
  tipoEquipo: string;
  cantidad: number;
  notas: string | null;
}

export interface EventoServicioCategoria {
  id: number;
  nombre: string;
  tipo: string;
}

export interface EventoServicioDetalle {
  id: number;
  titulo: string;
  categoriaId: number | null;
  categoriaNombre: string | null;
  categoriaTipo: string | null;
  esAddon: boolean;
  estado?: {
    id: number;
    nombre: string;
  } | null;
  evento: {
    id: number;
    nombre: string;
  };
  servicio: {
    id: number;
    nombre: string;
  };
  precio: number | null;
  descripcion: string | null;
  horas: number | null;
  fotosImpresas: number | null;
  trailerMin: number | null;
  filmMin: number | null;
  staff: {
    total: number;
    detalle: EventoServicioStaff[];
  } | null;
  equipos: EventoServicioEquipo[];
}

export interface CrearEventoServicioRequest {
  servicio: number;
  evento: number;
  titulo: string;
  categoriaId?: number | null;
  esAddon?: boolean;
  precio?: number;
  descripcion?: string | null;
  horas?: number | null;
  fotosImpresas?: number | null;
  trailerMin?: number | null;
  filmMin?: number | null;
  staff: EventoServicioStaff[];
  equipos: { tipoEquipoId: number; cantidad: number; notas?: string | null }[];
}

export interface ActualizarEventoServicioRequest {
  servicio?: number;
  evento?: number;
  titulo?: string;
  categoriaId?: number | null;
  esAddon?: boolean;
  precio?: number;
  descripcion?: string | null;
  horas?: number | null;
  fotosImpresas?: number | null;
  trailerMin?: number | null;
  filmMin?: number | null;
  staff: EventoServicioStaff[];
  equipos: { tipoEquipoId: number; cantidad: number; notas?: string | null }[];
}

export interface ActualizarEstadoEventoServicioResponse {
  Status: string;
  idEventoServicio: number;
  estadoId: number;
}

