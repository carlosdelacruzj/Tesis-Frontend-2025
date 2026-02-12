import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable, map } from 'rxjs';
import { corregirCumple } from 'src/app/shared/utils/text-utils';

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
            nombre: corregirCumple(e.nombre),
          })),
        ),
      );
  }
}
