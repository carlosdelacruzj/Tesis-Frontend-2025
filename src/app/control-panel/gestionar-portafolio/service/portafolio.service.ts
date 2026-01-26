import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PortafolioEvento, PortafolioImagen, PortafolioPublico, PortafolioRespuesta } from '../model/portafolio.model';

@Injectable({ providedIn: 'root' })
export class PortafolioService {
  private readonly API = `${environment.baseUrl}/portafolio`;
  private readonly http = inject(HttpClient);

  getEventos(): Observable<PortafolioEvento[]> {
    return this.http.get<PortafolioEvento[]>(`${this.API}/eventos`);
  }

  actualizarVisibilidadEvento(id: number, mostrar: number): Observable<PortafolioRespuesta> {
    return this.http.patch<PortafolioRespuesta>(`${this.API}/eventos/${id}/mostrar`, { mostrar });
  }

  getImagenes(eventoId?: number | null): Observable<PortafolioImagen[]> {
    let params = new HttpParams();
    if (eventoId != null) {
      params = params.set('eventoId', String(eventoId));
    }
    return this.http.get<PortafolioImagen[]>(`${this.API}/imagenes`, { params });
  }

  getPortafolioPublico(): Observable<PortafolioPublico[]> {
    return this.http.get<PortafolioPublico[]>(`${this.API}/publico`);
  }

  crearImagen(payload: {
    eventoId: number;
    tituloBase?: string | null;
    descripcion?: string | null;
    ordenBase?: number | null;
    files: File[];
  }): Observable<PortafolioRespuesta> {
    const fd = new FormData();
    fd.append('eventoId', String(payload.eventoId));
    if (payload.tituloBase) fd.append('tituloBase', payload.tituloBase);
    if (payload.descripcion) fd.append('descripcion', payload.descripcion);
    if (payload.ordenBase != null) fd.append('ordenBase', String(payload.ordenBase));
    payload.files.forEach(file => {
      fd.append('files', file, file.name);
    });

    return this.http.post<PortafolioRespuesta>(`${this.API}/imagenes`, fd);
  }

  actualizarImagen(
    id: number,
    payload: {
      eventoId?: number | null;
      titulo?: string | null;
      descripcion?: string | null;
      orden?: number | null;
      file?: File | null;
    }
  ): Observable<PortafolioRespuesta> {
    const fd = new FormData();
    if (payload.eventoId != null) fd.append('eventoId', String(payload.eventoId));
    if (payload.titulo) fd.append('titulo', payload.titulo);
    if (payload.descripcion) fd.append('descripcion', payload.descripcion);
    if (payload.orden != null) fd.append('orden', String(payload.orden));
    if (payload.file) fd.append('file', payload.file, payload.file.name);

    return this.http.put<PortafolioRespuesta>(`${this.API}/imagenes/${id}`, fd);
  }

  eliminarImagen(id: number): Observable<PortafolioRespuesta> {
    return this.http.delete<PortafolioRespuesta>(`${this.API}/imagenes/${id}`);
  }
}
