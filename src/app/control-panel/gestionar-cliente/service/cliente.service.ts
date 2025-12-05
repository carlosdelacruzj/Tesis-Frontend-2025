// src/app/services/cliente.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Cliente, ClienteUpdate, EstadoCliente } from '../model/cliente.model';

@Injectable({ providedIn: 'root' })
export class ClienteService {

  // Mantengo tu objeto seleccionado tal cual
  selectCliente: Cliente = {
    idCliente: 0,
    codigoCliente: '',
    nombre: '',
    apellido: '',
    correo: '',
    celular: '',
    doc: '',
    direccion: '',
    estadoCliente: ''
  };

  private API_PRUEBA = `${environment.baseUrl}/clientes`;

  constructor(private http: HttpClient) {}

  // Modernizo a firstValueFrom (en Angular/RxJS recientes toPromise está deprecado)
  public getAllClientes(): Promise<Cliente[]> {
    return firstValueFrom(this.http.get<Cliente[]>(this.API_PRUEBA));
  }

  // POST /clientes
  // Si tu backend espera numDoc (no "doc"), mapeamos doc -> numDoc si viene así del form.
  public addCliente(data: any): Observable<any> {
    const url = this.API_PRUEBA;
    const payload = this.compact({
      nombre: data.nombre,
      apellido: data.apellido,
      correo: data.correo,
      numDoc: data.numDoc ?? data.doc, // ← mapeo seguro
      celular: data.celular,
      direccion: data.direccion,
      // agrega aquí otros campos que realmente soporte tu endpoint
    });
    return this.http.post(url, payload);
  }

  // GET /clientes/{id}
  public getByIdCliente(id: number | string): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.API_PRUEBA}/${id}`);
  }

  // GET /clientes/estados
  public getEstadosCliente(): Observable<EstadoCliente[]> {
    return this.http.get<EstadoCliente[]>(`${this.API_PRUEBA}/estados`);
  }

  // PATCH /clientes/{id}/estado
  public actualizarEstadoCliente(id: number | string, estadoClienteId: number): Observable<Cliente> {
    return this.http.patch<Cliente>(`${this.API_PRUEBA}/${id}/estado`, { estadoClienteId });
  }

  // ✅ Mantengo tu firma original para no romper nada:
  // putClienteById(data) donde data contiene idCliente y los cambios.
  // Envía: PUT /clientes/{idCliente} con body {correo?,celular?,direccion?}
  public putClienteById(data: any): Observable<Cliente> {
    const id =
      data?.idCliente ??
      data?.id ??
      data?.ID ??
      null;

    if (id === null || id === undefined) {
      throw new Error('putClienteById requiere "idCliente" (o "id").');
    }

    const body: ClienteUpdate = this.compact({
      correo: data?.correo,
      celular: data?.celular,
      direccion: data?.direccion,
    });

    return this.http.put<Cliente>(`${this.API_PRUEBA}/${id}`, body);
  }

  // ✅ Versión clara sugerida (cuando migres tus llamados en componentes):
  // updateClienteById(1, { correo: 'a@b.com' })
  public updateClienteById(id: number, changes: ClienteUpdate): Observable<Cliente> {
    const body = this.compact(changes);
    return this.http.put<Cliente>(`${this.API_PRUEBA}/${id}`, body);
  }

  // Utilidad: elimina null/undefined/'' del objeto antes de enviarlo
  private compact<T extends object>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== null && v !== undefined && v !== '')
    ) as T;
  }
}
