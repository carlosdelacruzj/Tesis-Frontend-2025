
export interface Empleado {
  idEmpleado: number;
  codigoEmpleado: string;
  idUsuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  celular: string;
  documento: string;
  tipoDocumentoId?: number;
  direccion: string;
  autonomo: 0 | 1 | 2 | 'SI' | 'NO';
  idCargo: number;
  cargo: string;
  esOperativoCampo: 0 | 1;
  idEstado: 1 | 2;
  estado?: 'Activo' | 'Inactivo';
  codigo?: string;
}

export type EmpleadoUpdateDto = Pick<
  Empleado,
  'idEmpleado' | 'correo' | 'celular' | 'direccion'
>;

export interface EmpleadoEstadoUpdateDto {
  estado: 1 | 2;
}

export interface EmpleadoOperativo {
  empleadoId: number;
  usuarioId: number;
  nombre: string;
  apellido: string;
  cargoId: number;
  cargo: string;
  estadoId: number;
  estado: string;
  operativoCampo: boolean;
}
