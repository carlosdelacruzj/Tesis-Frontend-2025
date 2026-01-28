// src/app/services/cliente.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Cliente, ClienteUpdate, EstadoCliente } from '../model/cliente.model';
import { CatalogosService } from 'src/app/shared/services/catalogos.service';

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private readonly http = inject(HttpClient);
  private readonly catalogos = inject(CatalogosService);

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

  private readonly apiBase = `${environment.baseUrl}/clientes`;

  // Modernizo a firstValueFrom (en Angular/RxJS recientes toPromise está deprecado)
  public getAllClientes(): Promise<Cliente[]> {
    return firstValueFrom(this.http.get<Cliente[]>(this.apiBase));
  }

  // POST /clientes
  // Si tu backend espera numDoc (no "doc"), mapeamos doc -> numDoc si viene así del form.
  public addCliente(data: ClienteCreateInput): Observable<Cliente> {
    const url = this.apiBase;
    const payload = {
      ...this.compact({
      nombre: data.nombre,
      apellido: data.apellido,
      correo: data.correo,
      numDoc: data.numDoc ?? data.doc, // ← mapeo seguro
      tipoDocumentoId: data.tipoDocumentoId,
      celular: data.celular,
      direccion: data.direccion,
      // agrega aquí otros campos que realmente soporte tu endpoint
      }),
      razonSocial: data.razonSocial ?? null
    };
    return this.http.post<Cliente>(url, payload);
  }

  // GET /clientes/{id}
  public getByIdCliente(id: number | string): Observable<Cliente> {
    return this.http.get<Cliente>(`${this.apiBase}/${id}`);
  }

  // GET /clientes/estados
  public getEstadosCliente(): Observable<EstadoCliente[]> {
    return this.catalogos.getEstadosCliente();
  }

  // PATCH /clientes/{id}/estado
  public actualizarEstadoCliente(id: number | string, estadoClienteId: number): Observable<Cliente> {
    return this.http.patch<Cliente>(`${this.apiBase}/${id}/estado`, { estadoClienteId });
  }

  // ✅ Mantengo tu firma original para no romper nada:
  // putClienteById(data) donde data contiene idCliente y los cambios.
  // Envía: PUT /clientes/{idCliente} con body {correo?,celular?,direccion?}
  public putClienteById(data: ClientePutInput): Observable<Cliente> {
    const id =
      data?.idCliente ??
      data?.id ??
      data?.ID ??
      null;

    if (id === null || id === undefined) {
      throw new Error('putClienteById requiere "idCliente" (o "id").');
    }

    const body: ClienteUpdate = this.compact({
      nombre: data?.nombre,
      apellido: data?.apellido,
      correo: data?.correo,
      celular: data?.celular,
      direccion: data?.direccion,
    });

    return this.http.put<Cliente>(`${this.apiBase}/${id}`, body);
  }

  // ✅ Versión clara sugerida (cuando migres tus llamados en componentes):
  // updateClienteById(1, { correo: 'a@b.com' })
  public updateClienteById(id: number, changes: ClienteUpdate): Observable<Cliente> {
    const body = this.compact(changes);
    return this.http.put<Cliente>(`${this.apiBase}/${id}`, body);
  }

  // Utilidad: elimina null/undefined/'' del objeto antes de enviarlo
  private compact<T extends object>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '')
    ) as T;
  }
}

interface ClienteCreateInput {
  nombre: string;
  apellido: string;
  correo: string;
  numDoc?: string;
  doc?: string;
  tipoDocumentoId?: number;
  razonSocial?: string;
  celular: string;
  direccion?: string | null;
}

interface ClientePutInput {
  idCliente?: number | string;
  id?: number | string;
  ID?: number | string;
  nombre?: string | null;
  apellido?: string | null;
  correo?: string | null;
  celular?: string | null;
  direccion?: string | null;
}
