export interface Evento {
  id: number;
  nombre: string;
  /**
   * URL del icono representativo. Se mantiene opcional mientras se evalúa su deprecación.
   */
  iconUrl?: string | null;
}

export interface Servicio {
  id: number;
  nombre: string;
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
  equipos: Array<{ tipoEquipoId: number; cantidad: number; notas?: string | null }>;
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
  equipos: Array<{ tipoEquipoId: number; cantidad: number; notas?: string | null }>;
}
