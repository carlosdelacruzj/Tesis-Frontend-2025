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
    const url = `${this.baseUrl}/usuario/consulta/getIniciarSesion/${correo}/${pass}`
    return this.http.get<AuthResponse>(url)
      .pipe(
        tap(resp => {
          if (resp[0].token) {
            localStorage.setItem('token', resp[0].token);
            // localStorage.setItem('codigo',resp)
            localStorage.setItem('correo', correo);
            this._usuario = {
              nombre: resp[0].nombre,
              apellido: resp[0].apellido,
              ID: resp[0].apellido,
              documento: resp[0].documento,
              rol: resp[0].rol,
              token: resp[0].token
            }
          }
        }),
        map(resp => resp[0].token),
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
    if (!localStorage.getItem('token')) {
      return of(false);
    }
    return this.http.get<AuthResponse>(`${this.baseUrl}/usuario/consulta/getIniciarSesion/${localStorage.getItem('correo')}/${localStorage.getItem('pass')}`)
      .pipe(
        map(resp => {
          resp = resp[0];
          return true;
        })
      )
  }
  logout(){
 
    localStorage.clear();

  }

}
