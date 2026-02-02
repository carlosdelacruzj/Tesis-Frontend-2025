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
  responsableId: number | null;
  responsableNombre: string | null;
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

export interface IncidenciaDia {
  incidenciaId: number;
  diaId: number;
  fecha: string;
  tipo: string;
  descripcion: string;
  empleadoId: number | null;
  empleadoReemplazoId: number | null;
  equipoId: number | null;
  equipoReemplazoId: number | null;
  usuarioId: number | null;
  createdAt: string;
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
  incidenciasDia: IncidenciaDia[];
}

export interface ProyectoAsignacionEmpleadoPayload {
  empleadoId: number;
  notas?: string | null;
}

export interface ProyectoAsignacionEquipoPayload {
  equipoId: number;
  responsableId?: number | null;
}

export interface ProyectoAsignacionDiaPayload {
  diaId: number;
  empleados: ProyectoAsignacionEmpleadoPayload[];
  equipos: ProyectoAsignacionEquipoPayload[];
}

export interface ProyectoAsignacionesPayload {
  proyectoId: number;
  dias: ProyectoAsignacionDiaPayload[];
}

export interface ProyectoAsignacionesDisponiblesEmpleado {
  empleadoId: number;
  usuarioId: number;
  nombre: string;
  apellido: string;
  cargoId: number;
  cargo: string;
}

export interface ProyectoAsignacionesDisponiblesEquipo {
  equipoId: number;
  serie: string;
  idModelo: number;
  nombreModelo: string;
  idTipoEquipo: number;
  nombreTipoEquipo: string;
}

export interface ProyectoAsignacionesDisponiblesResponse {
  empleados: ProyectoAsignacionesDisponiblesEmpleado[];
  equipos: ProyectoAsignacionesDisponiblesEquipo[];
}

export interface ProyectoEstadoItem {
  id: number;
  nombre: string;
}

export interface ProyectoEstadoResponse {
  ok: boolean;
  data: ProyectoEstadoItem[];
}

export interface ProyectoDiaEstadoItem {
  id: number;
  nombre: string;
}

export interface ProyectoDiaEstadoResponse {
  ok: boolean;
  data: ProyectoDiaEstadoItem[];
}

export interface ProyectoIncidenciaPayload {
  tipo: 'PERSONAL_NO_ASISTE' | 'EQUIPO_FALLA_EN_EVENTO' | 'OTROS';
  descripcion: string;
  empleadoId?: number | null;
  empleadoReemplazoId?: number | null;
  equipoId?: number | null;
  equipoReemplazoId?: number | null;
  usuarioId?: number | null;
}

export type ProyectoPayload = {
  pedidoId?: number | null;
  responsableId?: number | null;
  notas?: string | null;
  enlace?: string | null;
};
