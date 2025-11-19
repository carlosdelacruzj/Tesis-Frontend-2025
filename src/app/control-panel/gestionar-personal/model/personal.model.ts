// export class Personal {
//     constructor(
//         public nombre: string,
//         public apellido: string,
//         public correo : string,
//         public celular : string,
//         public doc : string,
//         public direccion : string,
//         public autonomo: 0,
//         public cargo: 0,
//         public estado:0
//     ) {}
//   }

//   export class PersonalListar {
//     constructor(
//     public      ID: number,
//     public     Nombres: string,
//     public     Apellidos: string,
//     public     DNI : string,
//     public     Celular : string,
//     public     Correo : string,
//     public     Autonomo : 0,
//     public     Cargo: string,
//     public     Estado: string,
//     public     Direccion:string
//     ) {}
      
//   }

//   export class PersonalActualizar {
//     constructor(
//     public      ID: number,
//     public     Nombres: string,
//     public     Apellidos: string,
//     public     DNI : string,
//     public     Celular : string,
//     public     Correo : string,
//     public     Autonomo : 0,
//     public     Cargo: string,
//     public     Estado: 0,
//     public     Direccion:string
//     ) {}
      
//   }
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
  idEstado: number;
  estado: 'DISPONIBLE' | 'NO_DISPONIBLE';
}

export type EmpleadoUpdateDto = Pick<
  Empleado,
  'idEmpleado' | 'correo' | 'celular' | 'direccion' | 'idEstado'
>;
