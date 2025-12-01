export interface Proyecto {
  proyectoId: number;
  proyectoNombre: string;
  pedidoId: number;
  estadoId: number | null;
  estadoNombre: string | null;
  fechaInicioEdicion: string | null;
  fechaFinEdicion: string | null;
  responsableId: number | null;
  responsableNombre?: string | null;
  notas: string | null;
  enlace: string | null;
  multimedia: number | null;
  edicion: number | null;
  createdAt?: string;
  updatedAt?: string;
  recursos?: ProyectoRecurso[];
}

export type ProyectoPayload = Omit<
  Proyecto,
  'proyectoId' | 'createdAt' | 'updatedAt' | 'recursos' | 'responsableNombre' | 'estadoNombre'
>;

export interface ProyectoRecurso {
  recursoId: number;
  proyectoId: number;
  empleadoId: number | null;
  empleadoNombre: string | null;
  equipoId: number;
  equipoSerie: string;
  modelo: string;
  tipoEquipo: string;
  estadoEquipoId: number;
  empleadoFechaInicio?: string | null;
  empleadoFechaFin?: string | null;
  empleadoEstado?: string | null;
  empleadoNotas?: string | null;
  equipoFechaInicio?: string | null;
  equipoFechaFin?: string | null;
  equipoEstado?: string | null;
  equipoNotas?: string | null;
  equipoDevuelto?: number | null;
  equipoFechaDevolucion?: string | null;
  equipoEstadoDevolucion?: string | null;
  equipoNotasDevolucion?: string | null;
  equipoUsuarioDevolucion?: string | null;
}

export interface ProyectoDetalle extends Proyecto {
  recursos: ProyectoRecurso[];
}
