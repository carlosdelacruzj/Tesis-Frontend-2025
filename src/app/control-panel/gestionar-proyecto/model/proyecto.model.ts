export interface Proyecto {
  proyectoId: number;
  proyectoNombre: string;
  pedidoId: number;
  fechaInicioEdicion: string | null;
  fechaFinEdicion: string | null;
  estadoId: number | null;
  estadoNombre: string | null;
  responsableId: number | null;
  notas: string | null;
  enlace: string | null;
  multimedia: number | null;
  edicion: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export type ProyectoPayload = Omit<Proyecto, 'proyectoId' | 'createdAt' | 'updatedAt'>;
