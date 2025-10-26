import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, map, tap } from "rxjs/operators";

import { AuthResponse, Usuario } from '../interfaces/auth.interface';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private http: HttpClient) { }
  private baseUrl: string = environment.baseUrl;
  private _usuario: Usuario;

  get usuario() {
    return { ...this._usuario };
  }

  login(correo: string, pass: string) {
    const url = `${this.baseUrl}/auth/login`;
    return this.http.post<AuthResponse>(url, { email: correo, password: pass })
      .pipe(
        tap(resp => {
          if (resp?.token) {
            localStorage.setItem('token', resp.token);
            localStorage.setItem('correo', correo);
            this._usuario = {
              nombre: resp.nombre ?? '',
              apellido: resp.apellido ?? '',
              ID: resp.ID ?? 0,
              documento: resp.documento ?? 0,
              rol: resp.rol ?? '',
              token: resp.token
            }
          }
        }),
        map(resp => resp?.token ?? null),
        catchError(err => of(false))
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
    return of(true);
  }
  logout(){
 
    localStorage.clear();

  }

}
