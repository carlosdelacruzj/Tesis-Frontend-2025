import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, firstValueFrom } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Evento, EventoServicioCategoria, EstadoEventoServicio, Servicio } from 'src/app/control-panel/administrar-paquete-servicio/model/evento-servicio.model';
import { TipoEquipo } from 'src/app/control-panel/administrar-equipos/models/tipo-equipo.model';
import { Cargo } from 'src/app/control-panel/gestionar-personal/service/personal.service';
import { EstadoCliente } from 'src/app/control-panel/gestionar-cliente/model/cliente.model';
import { ProyectoDiaEstadoItem, ProyectoDiaEstadoResponse, ProyectoEstadoItem, ProyectoEstadoResponse } from 'src/app/control-panel/gestionar-proyecto/model/proyecto.model';
import { MetodoPago } from 'src/app/control-panel/registrar-pago/model/metodopago.model';

export type CatalogoKey =
  | 'eventos'
  | 'servicios'
  | 'cargos'
  | 'estadosProyecto'
  | 'estadosDiasProyecto'
  | 'estadosCliente'
  | 'metodosPago'
  | 'estadosEventoServicio'
  | 'categoriasEventoServicio'
  | 'tiposEquipo';

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);

  private readonly cache = new Map<CatalogoKey, Observable<unknown[]>>();
  private readonly values = new Map<CatalogoKey, unknown[]>();

  private readonly baseUrl = environment.baseUrl;

  private getOrLoad<T>(key: CatalogoKey, url: string): Observable<T[]> {
    const cached = this.cache.get(key) as Observable<T[]> | undefined;
    if (cached) {
      return cached;
    }

    const request$ = this.http.get<T[]>(url).pipe(
      tap((data) => {
        this.values.set(key, Array.isArray(data) ? data : []);
      }),
      catchError((err) => {
        console.error(`[catalogos] ${key}`, err);
        this.values.set(key, []);
        return of([] as T[]);
      }),
      shareReplay(1)
    );

    this.cache.set(key, request$ as Observable<unknown[]>);
    return request$;
  }

  preload(): Promise<void> {
    return firstValueFrom(
      forkJoin([
        this.getEventos(),
        this.getServicios(),
        this.getEstadosProyecto(),
        this.getEstadosDiasProyecto(),
        this.getEstadosCliente(),
        this.getCargos(),
        this.getMetodosPago(),
        this.getEstadosEventoServicio(),
        this.getCategoriasEventoServicio(),
        this.getTiposEquipo()
      ])
    ).then(() => undefined);
  }

  invalidate(key: CatalogoKey): void {
    this.cache.delete(key);
    this.values.delete(key);
  }

  getSnapshot<T>(key: CatalogoKey): T[] {
    return (this.values.get(key) as T[] | undefined) ?? [];
  }

  getEventos(): Observable<Evento[]> {
    return this.getOrLoad<Evento>('eventos', `${this.baseUrl}/eventos`);
  }

  getServicios(): Observable<Servicio[]> {
    return this.getOrLoad<Servicio>('servicios', `${this.baseUrl}/servicios`);
  }

  getCargos(): Observable<Cargo[]> {
    return this.getOrLoad<Cargo>('cargos', `${this.baseUrl}/empleados/cargos`);
  }

  getEstadosProyecto(): Observable<ProyectoEstadoItem[]> {
    const cached = this.cache.get('estadosProyecto') as Observable<ProyectoEstadoItem[]> | undefined;
    if (cached) {
      return cached;
    }

    const request$ = this.http.get<ProyectoEstadoResponse>(`${this.baseUrl}/proyecto/estados`).pipe(
      map((response) => (Array.isArray(response?.data) ? response.data : [])),
      tap((data) => {
        this.values.set('estadosProyecto', data);
      }),
      catchError((err) => {
        console.error('[catalogos] estadosProyecto', err);
        this.values.set('estadosProyecto', []);
        return of([] as ProyectoEstadoItem[]);
      }),
      shareReplay(1)
    );

    this.cache.set('estadosProyecto', request$ as Observable<unknown[]>);
    return request$;
  }

  getEstadosDiasProyecto(): Observable<ProyectoDiaEstadoItem[]> {
    const cached = this.cache.get('estadosDiasProyecto') as Observable<ProyectoDiaEstadoItem[]> | undefined;
    if (cached) {
      return cached;
    }

    const request$ = this.http.get<ProyectoDiaEstadoResponse>(`${this.baseUrl}/proyecto/dias/estados`).pipe(
      map((response) => (Array.isArray(response?.data) ? response.data : [])),
      tap((data) => {
        this.values.set('estadosDiasProyecto', data);
      }),
      catchError((err) => {
        console.error('[catalogos] estadosDiasProyecto', err);
        this.values.set('estadosDiasProyecto', []);
        return of([] as ProyectoDiaEstadoItem[]);
      }),
      shareReplay(1)
    );

    this.cache.set('estadosDiasProyecto', request$ as Observable<unknown[]>);
    return request$;
  }

  getEstadosCliente(): Observable<EstadoCliente[]> {
    return this.getOrLoad<EstadoCliente>('estadosCliente', `${this.baseUrl}/clientes/estados`);
  }

  getMetodosPago(): Observable<MetodoPago[]> {
    return this.getOrLoad<MetodoPago>('metodosPago', `${this.baseUrl}/pagos/metodos`);
  }

  getEstadosEventoServicio(): Observable<EstadoEventoServicio[]> {
    return this.getOrLoad<EstadoEventoServicio>('estadosEventoServicio', `${this.baseUrl}/eventos_servicios/estados`);
  }

  getCategoriasEventoServicio(): Observable<EventoServicioCategoria[]> {
    return this.getOrLoad<EventoServicioCategoria>('categoriasEventoServicio', `${this.baseUrl}/eventos_servicios/categorias`);
  }

  getTiposEquipo(): Observable<TipoEquipo[]> {
    return this.getOrLoad<TipoEquipo>('tiposEquipo', `${this.baseUrl}/inventario/tipos-equipo`);
  }
}
