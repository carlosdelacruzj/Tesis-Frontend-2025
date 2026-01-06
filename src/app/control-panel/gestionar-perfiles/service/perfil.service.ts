import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Perfil } from '../model/perfil.model';

@Injectable({
  providedIn: 'root'
})
export class PerfilService {

  selectPerfil: Perfil = {
    ID: 0,
    ROL: '',
    nombre: '',
    apellido: '',
    correo: '',
    celular: '',
    doc: '',
    direccion: '',
  };
  
  private readonly http = inject(HttpClient);
  private readonly apiBase = 'https://tp2021database.herokuapp.com/perfiles';
  private readonly apiPerfiles = `${this.apiBase}/consulta/getAllPerfiles`;
  private readonly apiRoles = `${this.apiBase}/consulta/getAllRoles`;
  private readonly apiRegistrar = `${this.apiBase}/registro/postPermiso`;
  private readonly apiDetalle = `${this.apiBase}/consulta/getByIdPerfil`;
  private readonly apiActualizar = `${this.apiBase}/actualiza/putPermiso`;

  public getAllPerfiles(): Promise<Perfil[]> {
    return this.http.get<Perfil[]>(this.apiPerfiles).toPromise();
  }

  public getAllRoles(): Observable<Record<string, unknown>[]> {
    return this.http.get<Record<string, unknown>[]>(this.apiRoles);
  }

  public postPermiso(data: Record<string, unknown>): Observable<unknown> {
    return this.http.post<unknown>(this.apiRegistrar, data);
  }

  public getByIdPerfil(id: number | string): Observable<unknown> {
    return this.http.get<unknown>(`${this.apiDetalle}/${id}`);
  }

  public putPermiso(data: Record<string, unknown>): Observable<unknown> {
    return this.http.put<unknown>(this.apiActualizar, data);
  }
}
