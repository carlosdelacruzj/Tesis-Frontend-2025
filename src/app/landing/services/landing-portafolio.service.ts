import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable, map } from 'rxjs';

export interface PortafolioPublicoImagen {
  id: number;
  eventoId: number;
  url: string;
  titulo?: string | null;
  descripcion?: string | null;
  orden?: number | null;
  fechaCreacion?: string | null;
}

export interface PortafolioPublicoEvento {
  id: number;
  nombre: string;
  iconUrl?: string | null;
  mostrarPortafolio: number;
  imagenes: PortafolioPublicoImagen[];
}

@Injectable({ providedIn: 'root' })
export class LandingPortafolioService {
  readonly baseUrl = environment.baseUrl;
  private readonly http = inject(HttpClient);

  getPortafolioPublico(): Observable<PortafolioPublicoEvento[]> {
    return this.http
      .get<PortafolioPublicoEvento[]>(`${this.baseUrl}/portafolio/publico`)
      .pipe(
        map((items) =>
          items.map((e) => ({
            ...e,
            nombre: corregirNombre(e.nombre),
          })),
        ),
      );
  }
}

function corregirNombre(nombre: string): string {
  if (!nombre) return nombre;

  // Corrige solo si viene exactamente "cumpleanos" (con cualquier mayúscula/minúscula)
  if (nombre.toLowerCase() === 'cumpleanos') {
    if (nombre === nombre.toUpperCase()) return 'CUMPLEAÑOS';
    if (nombre[0] === nombre[0].toUpperCase()) return 'Cumpleaños';
    return 'cumpleaños';
  }

  return nombre;
}
