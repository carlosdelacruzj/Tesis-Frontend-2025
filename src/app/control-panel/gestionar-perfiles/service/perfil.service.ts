import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ActualizarPerfilPayload,
  ActualizarPerfilResponse,
  AsignarPerfilPayload,
  AsignarPerfilResponse,
  CambiarEstadoPerfilPayload,
  CambiarEstadoPerfilResponse,
  CrearPerfilPayload,
  CrearPerfilResponse,
  PerfilCatalogo,
  RemoverPerfilResponse,
  UsuarioPerfilesResponse
} from '../model/perfil.model';

@Injectable({
  providedIn: 'root'
})
export class PerfilService {
  
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.baseUrl;
  private readonly apiPerfiles = `${this.apiBase}/acceso/perfiles`;
  selectedPerfilCodigo: string | null = null;

  getPerfiles(): Observable<PerfilCatalogo[]> {
    return this.http.get<PerfilCatalogo[]>(this.apiPerfiles, { headers: this.authHeaders() });
  }

  crearPerfil(payload: CrearPerfilPayload): Observable<CrearPerfilResponse> {
    return this.http.post<CrearPerfilResponse>(this.apiPerfiles, payload, { headers: this.authHeaders() });
  }

  actualizarPerfil(perfilCodigo: string, payload: ActualizarPerfilPayload): Observable<ActualizarPerfilResponse> {
    return this.http.put<ActualizarPerfilResponse>(`${this.apiPerfiles}/${encodeURIComponent(perfilCodigo)}`, payload, {
      headers: this.authHeaders()
    });
  }

  cambiarEstadoPerfil(perfilCodigo: string, activo: boolean): Observable<CambiarEstadoPerfilResponse> {
    const payload: CambiarEstadoPerfilPayload = { activo };
    return this.http.patch<CambiarEstadoPerfilResponse>(
      `${this.apiPerfiles}/${encodeURIComponent(perfilCodigo)}/estado`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  getUsuarioPerfiles(usuarioId: number): Observable<UsuarioPerfilesResponse> {
    return this.http.get<UsuarioPerfilesResponse>(`${this.apiBase}/acceso/usuarios/${usuarioId}/perfiles`, {
      headers: this.authHeaders()
    });
  }

  asignarPerfil(usuarioId: number, payload: AsignarPerfilPayload): Observable<AsignarPerfilResponse> {
    return this.http.post<AsignarPerfilResponse>(`${this.apiBase}/acceso/usuarios/${usuarioId}/perfiles`, payload, {
      headers: this.authHeaders()
    });
  }

  asignarPerfilPorCodigo(usuarioId: number, perfilCodigo: string, principal = false): Observable<AsignarPerfilResponse> {
    return this.asignarPerfil(usuarioId, { perfilCodigo, principal });
  }

  removerPerfil(usuarioId: number, perfilCodigo: string): Observable<RemoverPerfilResponse> {
    return this.http.delete<RemoverPerfilResponse>(
      `${this.apiBase}/acceso/usuarios/${usuarioId}/perfiles/${encodeURIComponent(perfilCodigo)}`,
      { headers: this.authHeaders() }
    );
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }
}
