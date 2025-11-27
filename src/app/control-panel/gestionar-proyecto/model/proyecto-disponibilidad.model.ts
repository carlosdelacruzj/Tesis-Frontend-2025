export interface ProyectoDisponibilidad {
  empleados: DisponibilidadEmpleado[];
  equipos: DisponibilidadEquipo[];
}

export interface DisponibilidadEmpleado {
  empleadoId: number;
  usuarioId: number;
  nombre: string;
  apellido: string;
  cargoId: number;
  cargo: string;
  estadoId: number;
  estado: string;
  operativoCampo: boolean;
  disponible: boolean;
  conflictos: DisponibilidadConflicto[];
}

export interface DisponibilidadEquipo {
  idEquipo: number;
  fechaIngreso: string;
  idModelo: number;
  nombreModelo: string;
  idMarca: number;
  nombreMarca: string;
  idTipoEquipo: number;
  nombreTipoEquipo: string;
  idEstado: number;
  nombreEstado: string;
  serie: string;
  disponible: boolean;
  conflictos: DisponibilidadConflicto[];
}

export interface DisponibilidadConflicto {
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  proyectoId: number;
}
