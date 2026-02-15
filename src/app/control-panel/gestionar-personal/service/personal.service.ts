// src/app/gestionar-personal/service/personal.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Empleado, EmpleadoEstadoUpdateDto, EmpleadoOperativo, EmpleadoUpdateDto } from '../model/personal.model';
import { CatalogosService } from 'src/app/shared/services/catalogos.service';

export interface Cargo {
  idCargo: number;
  cargoNombre: string;
  esOperativoCampo: 0 | 1;
}

@Injectable({ providedIn: 'root' })
export class PersonalService {
  private readonly base = `${environment.baseUrl}/empleados`;
  private readonly baseOperativos = `${environment.baseUrl}/empleados/operativos`;

  private readonly http = inject(HttpClient);
  private readonly catalogos = inject(CatalogosService);

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

  // PATCH /empleados/{id}/estado
  actualizarEstadoEmpleado(id: number, estado: 1 | 2): Observable<Empleado> {
    const payload: EmpleadoEstadoUpdateDto = { estado };
    return this.http.patch<Empleado>(`${this.base}/${id}/estado`, payload);
  }

  // GET /empleados/cargos  (opcional)
  getCargos(): Observable<Cargo[]> {
    return this.catalogos.getCargos();
  }

  // GET /empleados/operativos
  getOperativos(): Observable<EmpleadoOperativo[]> {
    return this.http.get<EmpleadoOperativo[]>(this.baseOperativos);
  }
}
