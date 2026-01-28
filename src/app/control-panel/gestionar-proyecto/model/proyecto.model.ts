export interface Proyecto {
  proyectoId: number;
  proyectoNombre: string;
  pedidoId: number;
  pedidoCodigo?: string | null;
  estadoId: number | null;
  estadoNombre: string | null;
  fechaInicioEdicion: string | null;
  fechaFinEdicion: string | null;
  responsableId: number | null;
  notas: string | null;
  enlace: string | null;
  multimedia?: number | null;
  edicion?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProyectoDetalle extends Proyecto {
  codigo?: string | null;
  pedidoCodigo?: string | null;
  responsableNombre?: string | null;
  fechaInicioEdicion: string;
  fechaFinEdicion: string;
  estadoId: number;
  estadoNombre: string;
  pedidoServicios?: PedidoServicio[];
  personalRequerido?: PersonalRequerido[];
  equiposRequeridos?: EquipoRequerido[];
  responsableId: number;
  notas: string;
  enlace: string;
}

export interface PedidoServicio {
  pedidoServicioId: number;
  eventoServicioId: number;
  nombre: string;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
  descripcion: string;
}

export interface PersonalRequerido {
  eventoServicioId: number;
  rol: string;
  cantidad: number;
}

export interface EquipoRequerido {
  eventoServicioId: number;
  tipoEquipoId: number;
  tipoEquipoNombre: string;
  cantidad: number;
  notas: string;
}

export interface ProyectoDia {
  diaId: number;
  proyectoId: number;
  fecha: string;
  estadoDiaId: number | null;
  estadoDiaNombre: string | null;
}

export interface BloqueDia {
  bloqueId: number;
  diaId: number;
  fecha: string;
  hora: string;
  ubicacion: string;
  direccion: string;
  notas: string | null;
  orden: number;
}

export interface ServicioDia {
  id: number;
  diaId: number;
  fecha: string;
  pedidoServicioId: number;
  eventoServicioId: number;
  nombre: string;
  descripcion: string;
  moneda: string;
  precioUnit: string;
  cantidad: string;
  descuento: string;
  recargo: string;
  subtotal: string;
}

export interface EmpleadoDia {
  asignacionId: number;
  diaId: number;
  fecha: string;
  empleadoId: number;
  empleadoNombre: string;
  estado: string;
  notas: string;
  rol?: string | null;
}

export interface EquipoDia {
  asignacionId: number;
  diaId: number;
  fecha: string;
  equipoId: number;
  equipoSerie: string;
  modelo: string;
  tipoEquipo: string;
  estadoEquipoId: number;
  estado: string;
  notas: string;
  devuelto: number;
  fechaDevolucion: string;
  estadoDevolucion: string;
  notasDevolucion: string;
  usuarioDevolucion: number;
}

export interface RequerimientoPersonalDia {
  diaId: number;
  fecha: string;
  rol: string;
  cantidad: string;
}

export interface RequerimientoEquipoDia {
  diaId: number;
  fecha: string;
  tipoEquipoId: number;
  tipoEquipoNombre: string;
  cantidad: string;
}

export interface ProyectoDetalleResponse {
  proyecto: ProyectoDetalle;
  dias: ProyectoDia[];
  bloquesDia: BloqueDia[];
  serviciosDia: ServicioDia[];
  empleadosDia: EmpleadoDia[];
  equiposDia: EquipoDia[];
  requerimientosPersonalDia: RequerimientoPersonalDia[];
  requerimientosEquipoDia: RequerimientoEquipoDia[];
}

export type ProyectoPayload = {
  pedidoId?: number | null;
  responsableId?: number | null;
  notas?: string | null;
  enlace?: string | null;
};
