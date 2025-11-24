
export interface Empleado {
  idEmpleado: number;
  codigoEmpleado: string;
  idUsuario: number;
  nombre: string;
  apellido: string;
  correo: string;
  celular: string;
  documento: string;
  direccion: string;
  autonomo: 1 | 2 | 'SI' | 'NO';
  idCargo: number;
  cargo: string;
  esOperativoCampo: 0 | 1;
  idEstado: 1 | 2;
  estado?: 'Activo' | 'Inactivo';
}

export type EmpleadoUpdateDto = Pick<
  Empleado,
  'idEmpleado' | 'correo' | 'celular' | 'direccion' | 'idEstado'
>;
