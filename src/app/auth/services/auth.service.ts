import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { map, tap } from "rxjs/operators";

import { AuthResponse, Usuario } from '../interfaces/auth.interface';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) { }
  private baseUrl: string = environment.baseUrl;
  private _usuario: Usuario | null = this.getUsuarioFromStorage();

  get usuario() {
    return this._usuario ? { ...this._usuario } : null;
  }

  esCliente(): boolean {
    const usuario = this.ensureUsuario();
    return !!usuario && usuario.clienteId != null;
  }

  esEmpleado(): boolean {
    const usuario = this.ensureUsuario();
    return !!usuario && usuario.empleadoId != null;
  }

  login(correo: string, contrasena: string): Observable<AuthResponse> {
    const url = `${this.baseUrl}/auth/login`;
    return this.http.post<AuthResponse>(url, { correo, contrasena })
      .pipe(
        tap(resp => {
          localStorage.setItem('token', resp.token);
          localStorage.setItem('correo', resp.usuario.correo);
          localStorage.setItem('usuario', JSON.stringify(resp.usuario));
          this._usuario = resp.usuario;
        })
      );
  }
  validacion(correo: string, codigo: number) {
    const url = `${this.baseUrl}/usuario/consulta/getValidacionCodex/${correo}/${codigo}`
    return this.http.get(url)
      .pipe(
        map(resp => resp[0])
      );
  }
  verificaAuteticacion(): Observable<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
      return of(false);
    }
    const usuario = this.ensureUsuario();
    return of(!!usuario && usuario.empleadoId != null);
  }
  logout(){
 
    localStorage.clear();
    this._usuario = null;

  }

  private getUsuarioFromStorage(): Usuario | null {
    const rawUsuario = localStorage.getItem('usuario');
    if (!rawUsuario) {
      return null;
    }
    try {
      return JSON.parse(rawUsuario) as Usuario;
    } catch {
      return null;
    }
  }

  private ensureUsuario(): Usuario | null {
    if (!this._usuario) {
      this._usuario = this.getUsuarioFromStorage();
    }
    return this._usuario;
  }

}
