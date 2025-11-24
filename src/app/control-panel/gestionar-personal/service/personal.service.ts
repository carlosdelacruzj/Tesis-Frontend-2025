// src/app/gestionar-personal/service/personal.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Empleado, EmpleadoUpdateDto } from '../model/personal.model';

// ❗ Opcionales: déjalos si usas esos endpoints; si no, elimínalos.
export interface Cargo {
  idCargo: number;
  cargoNombre: string;
  esOperativoCampo: 0 | 1;
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

@Injectable({ providedIn: 'root' })
export class PersonalService {
  private readonly base = `${environment.baseUrl}/empleados`;
  private readonly baseOperativos = `${environment.baseUrl}/empleados/operativos`;

  constructor(private http: HttpClient) {}

  // POST /empleados
  createEmpleado(data: Partial<Empleado>): Observable<Empleado> {
    return this.http.post<Empleado>(this.base, data);
  }

  // GET /empleados
  getEmpleados(): Observable<Empleado[]> {
    return this.http.get<Empleado[]>(this.base);
  }

  // GET /empleados/{id}
  getEmpleadoById(id: number): Observable<Empleado> {
    return this.http.get<Empleado>(`${this.base}/${id}`);
  }

  // PUT /empleados/{id}
  updateEmpleado(dto: EmpleadoUpdateDto): Observable<Empleado> {
    return this.http.put<Empleado>(`${this.base}/${dto.idEmpleado}`, dto);
  }

  // GET /empleados/cargos  (opcional)
  getCargos(): Observable<Cargo[]> {
    return this.http.get<Cargo[]>(`${this.base}/cargos`);
  }

  // GET /empleados/operativos
  getOperativos(): Observable<EmpleadoOperativo[]> {
    return this.http.get<EmpleadoOperativo[]>(this.baseOperativos);
  }
}
