export interface Proyecto {
  proyectoId: number;
  codigo?: string | null;
  proyectoNombre: string;
  pedidoId: number;
  pedidoCodigo?: string | null;
  estadoId: number | null;
  estadoNombre: string | null;
  responsableId?: number | null;
  responsableNombre?: string | null;
  eventoFecha?: string | null;
  diasParaEvento?: number | null;
  lugar?: string | null;
  ubicacion?: string | null;
  estadoPagoId?: number | null;
  estadoPagoNombre?: string | null;
  saldoPendiente?: number | null;
  pendientesDevolucion?: number | null;
  tienePendientes?: number | null;
  postproduccion?: ProyectoPostproduccion | null;
  notas?: string | null;
  enlace?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProyectoDetalle extends Proyecto {
  estadoId: number;
  estadoNombre: string;
  pedidoServicios?: PedidoServicio[];
  personalRequerido?: PersonalRequerido[];
  equiposRequeridos?: EquipoRequerido[];
  notas?: string | null;
  enlace?: string | null;
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
  cargoId?: number | null;
  cargo?: string | null;
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
  notas: string | null;
  devuelto: number;
  fechaDevolucion: string | null;
  estadoDevolucion: string | null;
  notasDevolucion: string | null;
  usuarioDevolucion: number | null;
}

export type ProyectoEstadoDevolucion = 'DEVUELTO' | 'DANADO' | 'PERDIDO' | 'ROBADO';

export interface ProyectoDevolucionEquipoItem {
  equipoId: number;
  devuelto: 0 | 1;
  estadoDevolucion?: ProyectoEstadoDevolucion | null;
  notasDevolucion?: string | null;
  fechaDevolucion?: string | null;
}

export interface ProyectoDevolucionEquiposPayload {
  usuarioId?: number | null;
  fechaDevolucion?: string | null;
  equipos: ProyectoDevolucionEquipoItem[];
}

export interface ProyectoDevolucionEquipoParcialPayload {
  devuelto: 0 | 1;
  estadoDevolucion?: ProyectoEstadoDevolucion | null;
  notasDevolucion?: string | null;
  fechaDevolucion?: string | null;
  usuarioId?: number | null;
}

export interface ProyectoDevolucionAsyncStartResponse {
  status: string;
  jobId: string;
  diaId: number;
}

export interface ProyectoDevolucionAsyncJobResult {
  status: string;
  diaId: number;
  equiposActualizados: number;
}

export interface ProyectoDevolucionAsyncJobStatusResponse {
  jobId: string;
  estado: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'ERROR';
  diaId: number;
  usuarioId: number | null;
  intentos: number;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: ProyectoDevolucionAsyncJobResult | null;
}

export interface ProyectoDevolucionPreviewRequest {
  fechaBase?: string;
  equipos?: ProyectoDevolucionPreviewEquipoRequestItem[];
  equipoId?: number;
  estadoDevolucion?: ProyectoEstadoDevolucion;
  diaId?: number;
}

export interface ProyectoDevolucionPreviewEquipoRequestItem {
  equipoId: number;
  estadoDevolucion: ProyectoEstadoDevolucion;
  diaId?: number;
  fechaBase?: string;
}

export interface ProyectoDevolucionPreviewEquipo {
  equipoId: number;
  serie: string;
  modeloId: number;
  modeloNombre: string;
  tipoEquipoId: number;
  tipoEquipoNombre: string;
}

export interface ProyectoDevolucionPreviewDiaAfectado {
  diaId: number;
  fecha: string;
  proyectoId: number;
  proyectoNombre: string;
}

export interface ProyectoDevolucionPreviewProyectoAfectado {
  proyectoId: number;
  proyectoNombre: string;
  diasAfectados: number;
  cantidadDesasignaciones: number;
}

export interface ProyectoDevolucionPreviewSimulacion {
  equipo: ProyectoDevolucionPreviewEquipo;
  estadoDevolucion: ProyectoEstadoDevolucion;
  estadoEquipoObjetivo: string;
  fechaBase: string;
  regla: string;
  aplicaDesasignacion: boolean;
  motivo: string;
  cantidadDesasignaciones: number;
  diasAfectados: ProyectoDevolucionPreviewDiaAfectado[];
  proyectosAfectados: ProyectoDevolucionPreviewProyectoAfectado[];
}

export interface ProyectoDevolucionPreviewResponse {
  status: string;
  simulacion?: ProyectoDevolucionPreviewSimulacion;
  simulaciones?: ProyectoDevolucionPreviewSimulacion[];
  resumen?: ProyectoDevolucionPreviewResumen;
}

export interface ProyectoDevolucionPreviewResumen {
  cantidadEquipos: number;
  cantidadDesasignaciones: number;
  proyectosAfectadosUnicos: number;
  diasAfectadosUnicos: number;
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
  fechaHoraEvento?: string | null;
  empleadoId: number | null;
  empleadoReemplazoId: number | null;
  equipoId: number | null;
  equipoReemplazoId: number | null;
  usuarioId: number | null;
  createdAt: string;
  empleadoNombre?: string | null;
  empleadoCargoId?: number | null;
  empleadoCargo?: string | null;
  empleadoReemplazoNombre?: string | null;
  empleadoReemplazoCargoId?: number | null;
  empleadoReemplazoCargo?: string | null;
  proyectoId?: number | null;
}

export interface ProyectoDetalleResponse {
  proyecto: ProyectoDetalle;
  postproduccion?: ProyectoPostproduccion | null;
  dias: ProyectoDia[];
  bloquesDia: BloqueDia[];
  serviciosDia: ServicioDia[];
  empleadosDia: EmpleadoDia[];
  equiposDia: EquipoDia[];
  requerimientosPersonalDia: RequerimientoPersonalDia[];
  requerimientosEquipoDia: RequerimientoEquipoDia[];
  incidenciasDia: IncidenciaDia[];
}

export interface ProyectoPostproduccion {
  fechaInicioEdicion: string | null;
  fechaFinEdicion: string | null;
  preEntregaEnlace: string | null;
  preEntregaTipo: string | null;
  preEntregaFeedback: string | null;
  preEntregaFecha: string | null;
  respaldoUbicacion: string | null;
  respaldoNotas: string | null;
  entregaFinalEnlace: string | null;
  entregaFinalFecha: string | null;
}

export interface ProyectoPostproduccionPayload {
  fechaInicioEdicion?: string | null;
  fechaFinEdicion?: string | null;
  preEntregaEnlace?: string | null;
  preEntregaTipo?: string | null;
  preEntregaFeedback?: string | null;
  preEntregaFecha?: string | null;
  respaldoUbicacion?: string | null;
  respaldoNotas?: string | null;
  entregaFinalEnlace?: string | null;
  entregaFinalFecha?: string | null;
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
  estadoDiaId: number;
  estadoDiaNombre: string;
  orden: number;
  activo: number;
}

export interface ProyectoIncidenciaPayload {
  tipo: 'PERSONAL_NO_ASISTE' | 'EQUIPO_FALLA_EN_EVENTO' | 'EQUIPO_ROBO_PERDIDA' | 'OTROS';
  descripcion: string;
  fechaHoraEvento?: string | null;
  empleadoId?: number | null;
  empleadoReemplazoId?: number | null;
  equipoId?: number | null;
  equipoReemplazoId?: number | null;
  usuarioId?: number | null;
}

export interface ProyectoCancelarDiaPayload {
  responsable: 'CLIENTE' | 'INTERNO';
  motivo: string;
  notas?: string | null;
}

export interface ProyectoCancelarDiaResponse {
  status: string;
  diaId: number;
  estadoDiaId?: number;
}

export type ProyectoPayload = {
  pedidoId?: number | null;
  responsableId?: number | null;
  notas?: string | null;
  enlace?: string | null;
};
