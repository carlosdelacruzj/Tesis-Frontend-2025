// src/app/gestionar-personal/service/personal.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Empleado, EmpleadoUpdateDto } from '../model/personal.model';

// ❗ Opcionales: déjalos si usas esos endpoints; si no, elimínalos.
export interface Cargo {
  idCargo: number;
  cargoNombre: string;
}
export type EmpleadoDisponible = Pick<
  Empleado,
  'idEmpleado' | 'codigoEmpleado' | 'nombre' | 'apellido' | 'idCargo' | 'cargo'
>;
export interface EmpleadoOption {
  idEmpleado: number;
  label: string; // si tu API usa otro nombre (p.ej. 'texto'), ajusta aquí
}

@Injectable({ providedIn: 'root' })
export class PersonalService {
  private readonly base = `${environment.baseUrl}/empleados`;

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
    return this.http.get<Empleado | Empleado[]>(`${this.base}/${id}`).pipe(
      map(r => Array.isArray(r) ? r[0] : r) // por si el backend retorna array
    );
  }

  // PUT /empleados/{id}
  updateEmpleado(dto: EmpleadoUpdateDto): Observable<Empleado> {
    return this.http.put<Empleado>(`${this.base}/${dto.idEmpleado}`, dto);
  }

  // GET /empleados/cargos  (opcional)
  getCargos(): Observable<Cargo[]> {
    return this.http.get<Cargo[]>(`${this.base}/cargos`);
  }

  // GET /empleados/disponibles/{idProyecto}  (opcional)
  getDisponiblesPorProyecto(idProyecto: number): Observable<EmpleadoDisponible[]> {
    return this.http.get<EmpleadoDisponible[]>(`${this.base}/disponibles/${idProyecto}`);
  }

  // GET /empleados/lista  (opcional: para selects)
  getEmpleadosLista(): Observable<EmpleadoOption[]> {
    return this.http.get<EmpleadoOption[]>(`${this.base}/lista`);
  }
}
