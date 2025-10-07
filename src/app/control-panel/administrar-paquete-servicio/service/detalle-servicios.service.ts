import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';

// Lo que realmente usa tu HTML con [(ngModel)]
export interface ServicioDetalle {
  ID: number;
  Servicio: string | number;     // flexible: tus comps a veces mandan number
  Precio: number | string;       // puede venir como string desde inputs
  Descripcion: string;
  Titulo: string;
}

// Estructura mínima que espera editar-servicio.component (sServicios)
export interface sServicios {
  ID: number;
  Nombre: string;                // tu comp pide 'Nombre' (no 'Servicio')
}

@Injectable({ providedIn: 'root' })
export class EventoAllServiciosService {
  private base = environment.baseUrl;

  // Necesario para tus [(ngModel)] en los templates
  selectProyecto: ServicioDetalle = {
    ID: 0,
    Servicio: '',
    Precio: 0,
    Descripcion: '',
    Titulo: ''
  };

  constructor(private http: HttpClient) {}

  /**
   * Catálogo de servicios, pero DEVUELTO en el shape que tu comp espera: sServicios[]
   * Mapeamos {ID, Servicio} -> {ID, Nombre}
   */
  getAllServicios(): Observable<sServicios[]> {
    return this.http.get<ServicioDetalle[]>(`${this.base}/servicios`).pipe(
      map(items =>
        (items ?? []).map(it => ({
          ID: Number(it.ID),
          Nombre: String((it as any).Nombre ?? it.Servicio ?? '')
        }))
      )
    );
  }

  /** Obtener un servicio por ID: tu comp espera un array, lo respetamos */
  getAllNombresID(id: number): Observable<ServicioDetalle[]> {
    return this.http.get<any>(`${this.base}/servicios/${id}`).pipe(
      map((res: any) => {
        // Si backend devuelve objeto, lo envolvemos en array
        const item = Array.isArray(res) ? res[0] : res;
        if (!item) return [];
        // Normalizamos campos por si vienen con nombres distintos
        return [{
          ID: Number(item.ID ?? item.id ?? id),
          Servicio: item.Servicio ?? item.Nombre ?? item.servicio ?? '',
          Precio: Number(item.Precio ?? item.precio ?? 0),
          Descripcion: item.Descripcion ?? item.descripcion ?? item.concepto ?? '',
          Titulo: item.Titulo ?? item.titulo ?? ''
        }];
      })
    );
  }

  /**
   * Crear:
   * - Si el payload trae 'evento', asumimos que es relación evento-servicio -> POST /eventos_servicios
   * - Si NO trae 'evento', asumimos que es un servicio -> POST /servicios
   *
   * Tus comps envían algo como:
   * { evento, servicio, precio, titulo, descripcion }
   */
  registro(data: any): Observable<any> {
    if (data && (data.evento !== undefined && data.evento !== null)) {
      const payload = {
        Evento: Number(data.evento),
        Servicio: Number(data.servicio),
        Precio: Number(data.precio ?? 0),
        Titulo: data.titulo ?? '',
        Descripcion: data.descripcion ?? data.concepto ?? ''
      };
      return this.http.post(`${this.base}/eventos_servicios`, payload);
    } else {
      const payload = {
        Servicio: String(data.servicio ?? data.Servicio ?? ''),
        Precio: Number(data.precio ?? data.Precio ?? 0),
        Titulo: data.titulo ?? data.Titulo ?? '',
        Descripcion: data.descripcion ?? data.Descripcion ?? data.concepto ?? ''
      };
      return this.http.post(`${this.base}/servicios`, payload);
    }
  }

  /**
   * Actualizar servicio:
   * Tus comps llaman registro2({ servicio, titulo, precio, concepto, id })
   */
  registro2(data: any): Observable<any> {
    const id = Number(data.ID ?? data.id);
    const payload = {
      Servicio: String(data.servicio ?? data.Servicio ?? ''),
      Precio: Number(data.precio ?? data.Precio ?? 0),
      Titulo: data.titulo ?? data.Titulo ?? '',
      Descripcion: data.concepto ?? data.descripcion ?? data.Descripcion ?? ''
    };
    return this.http.put(`${this.base}/servicios/${id}`, payload);
  }
}
