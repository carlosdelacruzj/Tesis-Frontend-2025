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
  empleadoId: number;
  empleadoNombre: string;
  equipoId: number;
  equipoSerie: string;
  modelo: string;
  tipoEquipo: string;
  estadoEquipoId: number;
}

export interface ProyectoDetalle extends Proyecto {
  recursos: ProyectoRecurso[];
}
