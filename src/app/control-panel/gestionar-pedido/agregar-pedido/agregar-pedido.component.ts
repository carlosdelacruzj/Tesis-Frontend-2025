import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { PedidoService } from '../service/pedido.service';
import { VisualizarService } from '../service/visualizar.service';
import { CotizacionService } from '../../gestionar-cotizaciones/service/cotizacion.service';
import { ClienteBusquedaResultado } from '../../gestionar-cotizaciones/model/cotizacion.model';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSort } from '@angular/material/sort';
import { FormControl } from '@angular/forms';
import { of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { formatDisplayDate, parseDateInput } from '../../../shared/utils/date-utils';
import { TableColumn } from 'src/app/components/table-base/table-base.component';

interface Tag {
  nombre: string;
  direccion: string;
  usedAt?: number;
}

interface PedidoPaqueteSeleccionado {
  key: string | number;
  eventKey: string | number | null;
  ID?: number;
  descripcion: string;
  precio: number;
  cantidad?: number;
  notas: string;
}

type AnyRecord = Record<string, unknown>;
interface UbicacionRow {
  ID: number;
  Direccion: string;
  Fecha: string;
  Hora: string;
  DireccionExacta: string;
  Notas: string;
}
type UbicacionRowEditable = UbicacionRow & { _backup?: UbicacionRow; editing?: boolean; _fechaPrev?: string };

@Component({
  selector: 'app-agregar-pedido',
  templateUrl: './agregar-pedido.component.html',
  styleUrls: ['./agregar-pedido.component.css']
})
export class AgregarPedidoComponent implements OnInit, AfterViewInit, OnDestroy {
  // ====== Columnas ======
  columnsToDisplay = ['Nro', 'Fecha', 'Hora', 'Direccion', 'DireccionExacta', 'Notas', 'Editar', 'Quitar'];
  paquetesColumns: TableColumn<PaqueteRow>[] = [
    { key: 'descripcion', header: 'Descripción', sortable: true },
    { key: 'precio', header: 'Precio', sortable: true, class: 'text-end text-nowrap', width: '120px' },
    { key: 'staff', header: 'Staff', sortable: true, class: 'text-center', width: '100px' },
    { key: 'horas', header: 'Horas', sortable: true, class: 'text-center', width: '100px' },
    { key: 'acciones', header: 'Seleccionar', sortable: false, filterable: false, class: 'text-center', width: '140px' }
  ];

  // ====== Data y catálogos ======
  servicios: AnyRecord[] = [];
  evento: AnyRecord[] = [];
  servicioSeleccionado = 1;
  eventoSeleccionado = 1;

  // ⚠️ Inicializados para que nunca sean undefined
  dataSource: MatTableDataSource<UbicacionRow> = new MatTableDataSource<UbicacionRow>([]);
  paquetesRows: PaqueteRow[] = [];

  // ====== MatSort (2 tablas)
  @ViewChild('sortUbic') sortUbic!: MatSort;

  private bindSorts() {
    if (this.sortUbic) this.dataSource.sort = this.sortUbic;
  }

  // ====== Estado general ======
  CodigoEmpleado = 1;
  infoCliente = { nombre: '-', apellido: '-', celular: '-', correo: '-', documento: '-', direccion: '-', idCliente: 0, idUsuario: 0 };
  dniCliente = '';
  clienteResultados: ClienteBusquedaResultado[] = [];
  clienteSearchLoading = false;
  clienteSearchError = '';
  clienteSeleccionado: ClienteBusquedaResultado | null = null;
  clienteBusquedaTermino = '';
  clienteSearchControl = new FormControl<string | ClienteBusquedaResultado>('');
  private readonly destroy$ = new Subject<void>();

  // ====== Evento actual (inputs) ======
  Direccion = '';
  DireccionExacta = '';
  NotasEvento = '';

  // ====== Fechas ======
  fechaCreate = new Date();
  minimo: string;
  maximo: string;

  // ====== Ubicaciones ======
  ubicacion: UbicacionRow[] = [{ ID: 0, Direccion: '', Fecha: '', Hora: '', DireccionExacta: '', Notas: '' }];

  // ====== Paquetes seleccionados ======
  selectedPaquetes: PedidoPaqueteSeleccionado[] = [];
  desID = 0;
  currentEventoKey: string | number | null = null;
  selectedPaquetesColumns: TableColumn<PedidoPaqueteSeleccionado>[] = [];

  // ====== TAGS ======
  tagsPedido: Tag[] = [];
  tagsCliente: Tag[] = [];

  public readonly pedidoService = inject(PedidoService);
  public readonly visualizarService = inject(VisualizarService);
  private readonly cotizacionService = inject(CotizacionService);
  private readonly cdr = inject(ChangeDetectorRef);

  // ====== Ciclo de vida ======
  ngOnInit(): void {
    this.resetFormState();
    this.getEventos();
    this.getServicio();
    this.getEventoxServicio();

    if (this.dniCliente) this.loadTagsCliente();

    this.clienteSearchControl.valueChanges
      .pipe(
        map(value => this.normalizeClienteTerm(value)),
        tap(value => {
          this.clienteBusquedaTermino = value;
          this.clienteSearchError = '';
          if (value.length <= 1) {
            this.clienteResultados = [];
            this.clienteSearchLoading = false;
            if (!value) {
              this.clienteSeleccionado = null;
            }
          }
        }),
        filter(value => value.length > 1),
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => {
          this.clienteSearchLoading = true;
        }),
        switchMap(query =>
          this.cotizacionService.buscarClientes(query).pipe(
            catchError(err => {
              console.error('[pedido] buscarClientes', err);
              this.clienteSearchError = 'No pudimos cargar clientes.';
              this.clienteSearchLoading = false;
              return of([]);
            })
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(result => {
        this.clienteSearchLoading = false;
        this.clienteResultados = Array.isArray(result) ? result : [];
      });
  }

  ngAfterViewInit(): void {
    // Enlaza sorts cuando ya existen las vistas
    this.bindSorts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resetFormState();
  }

  // ====== Helpers TAGS ======
  get tagStorageKey(): string {
    return `ubicTags:${this.dniCliente || 'anon'}`;
  }

  private norm(s: string): string {
    return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private findTagIndexByNombre(arr: Tag[], nombre: string): number {
    const n = this.norm(nombre);
    return arr.findIndex(t => this.norm(t.nombre) === n);
  }

  private asRecord(value: unknown): AnyRecord {
    return value && typeof value === 'object' ? (value as AnyRecord) : {};
  }

  private getPkgKey(el: unknown): string | number {
    const record = this.asRecord(el);
    const descripcion = String(record['descripcion'] ?? '').trim();
    return (
      record['ID'] ??
      record['PK_ExS_Cod'] ??
      record['pk'] ??
      `${descripcion}|${record['precio'] ?? ''}`
    ) as string | number;
  }
  public pkgKey = (el: AnyRecord) => this.getPkgKey(el);

  get canGuardarTag(): boolean {
    const u = this.norm(this.Direccion);
    const dx = (this.DireccionExacta || '').trim();
    return !!(u && dx && dx.length >= 8);
  }

  loadTagsCliente() {
    if (!this.dniCliente) {
      this.tagsCliente = [];
      return;
    }

    try {
      const raw = localStorage.getItem(this.tagStorageKey);
      this.tagsCliente = raw ? JSON.parse(raw) : [];
    } catch {
      this.tagsCliente = [];
    }
  }

  saveTagsCliente() {
    if (!this.dniCliente) {
      return;
    }

    const max = 12;
    const arr = this.tagsCliente
      .sort((a: Tag, b: Tag) => (b.usedAt || 0) - (a.usedAt || 0))
      .slice(0, max);
    localStorage.setItem(this.tagStorageKey, JSON.stringify(arr));
  }

  saveTag(scope: 'pedido' | 'cliente') {
    if (!this.canGuardarTag) return;

    const nombre = (this.Direccion || '').trim();
    const direccion = (this.DireccionExacta || '').trim();
    const now = Date.now();

    if (scope === 'pedido') {
      const idx = this.findTagIndexByNombre(this.tagsPedido, nombre);
      if (idx >= 0) {
        this.tagsPedido[idx] = { ...this.tagsPedido[idx], direccion, usedAt: now };
        const updated = this.tagsPedido.splice(idx, 1)[0];
        this.tagsPedido.unshift(updated);
      } else {
        this.tagsPedido.unshift({ nombre, direccion, usedAt: now });
      }
    } else {
      const idx = this.findTagIndexByNombre(this.tagsCliente, nombre);
      if (idx >= 0) {
        this.tagsCliente[idx] = { ...this.tagsCliente[idx], direccion, usedAt: now };
        const updated = this.tagsCliente.splice(idx, 1)[0];
        this.tagsCliente.unshift(updated);
      } else {
        this.tagsCliente.unshift({ nombre, direccion, usedAt: now });
      }
      this.saveTagsCliente();
    }
  }

  applyTag(tag: Tag) {
    this.Direccion = tag.nombre;
    this.DireccionExacta = tag.direccion;
    tag.usedAt = Date.now();
    this.tagsCliente = [...this.tagsCliente];
    this.saveTagsCliente();
  }

  removeTag(tag: Tag, scope: 'pedido' | 'cliente') {
    const same = (t: Tag) =>
      this.norm(t.nombre) === this.norm(tag.nombre) &&
      this.norm(t.direccion) === this.norm(tag.direccion);

    if (scope === 'pedido') {
      this.tagsPedido = this.tagsPedido.filter(t => !same(t));
    } else {
      this.tagsCliente = this.tagsCliente.filter(t => !same(t));
      this.saveTagsCliente();
    }
  }

  // ====== Fechas ======
  fechaValidate(date) {
    this.minimo = this.addDaysToDate(date, -10);
    this.maximo = this.addDaysToDate(date, 365);
  }

  convert(str: string | Date) {
    const parsed = parseDateInput(str) ?? new Date();
    const mnth = ('0' + (parsed.getMonth() + 1)).slice(-2);
    const day = ('0' + parsed.getDate()).slice(-2);
    return [parsed.getFullYear(), mnth, day].join('-');
  }

  addDaysToDate(date, days) {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return this.convert(res);
  }

  weekdayPeru(fechaISO: string): string {
    const parsed = parseDateInput(fechaISO);
    if (!parsed) {
      return '';
    }
    const midDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
    const fmt = new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'America/Lima' });
    return fmt.format(midDay);
  }

  formatProgramDate(value: string | Date): string {
    return formatDisplayDate(value, '');
  }

  rowInvalid(row: UbicacionRow): boolean {
    const fechaOk = !!row.Fecha;
    const horaOk = !!row.Hora;
    const dex = (row.DireccionExacta || '').trim();
    const direccionOk = !!(row.Direccion && row.Direccion.trim());
    const dexOk = dex.length >= 8;
    return !(fechaOk && horaOk && direccionOk && dexOk);
  }

  // ====== Cliente ======
  getDataCliente(dni: number | string) {
    const obs = this.pedidoService.getDni?.(dni);
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getDni] devolvió undefined o no-Observable');
      return;
    }
    obs.pipe(
      catchError((err: unknown) => {
        console.error('[getDni] error dentro del stream', err);
        return of([]); // fallback
      })
    ).subscribe((res: unknown) => {
      if (!Array.isArray(res) || res.length === 0) {
        return;
      }
      const raw = res[0] ?? {};
      const nombre = this.toOptionalString(raw.nombre ?? raw.Nombre);
      const apellido = this.toOptionalString(raw.apellido ?? raw.Apellido);
      const documento = this.toOptionalString(raw.documento ?? raw.Documento ?? raw.numeroDocumento);
      const correo = this.toOptionalString(raw.correo ?? raw.email ?? raw.Correo);
      const celular = this.toOptionalString(raw.celular ?? raw.telefono ?? raw.Celular);
      const direccion = this.toOptionalString(raw.direccion ?? raw.Direccion);
      const idCliente = this.parseNumberNullable(raw.idCliente ?? raw.IdCliente ?? raw.id);
      const idUsuario = this.parseNumberNullable(raw.idUsuario ?? raw.IdUsuario ?? raw.usuarioId);

      this.infoCliente = {
        nombre: nombre || this.infoCliente.nombre || '-',
        apellido: apellido || this.infoCliente.apellido || '-',
        celular: celular || this.infoCliente.celular || '-',
        correo: correo || this.infoCliente.correo || '-',
        documento: documento || this.infoCliente.documento || this.dniCliente || '-',
        direccion: direccion || this.infoCliente.direccion || '-',
        idCliente: idCliente ?? this.infoCliente.idCliente ?? 0,
        idUsuario: idUsuario ?? this.infoCliente.idUsuario ?? 0
      };

      if (documento) {
        this.dniCliente = documento;
      }

      this.loadTagsCliente();
    });
  }

  seleccionarCliente(cliente: ClienteBusquedaResultado): void {
    if (!cliente) {
      return;
    }

    this.clienteSeleccionado = cliente;
    const documento = this.resolveClienteDocumento(cliente);
    this.dniCliente = documento || '';
    this.visualizarService.selectAgregarPedido.doc = this.dniCliente;
    this.setInfoClienteFromResultado(cliente);
    this.clienteResultados = [];
    this.clienteSearchControl.setValue(cliente, { emitEvent: false });
    this.clienteSearchControl.disable({ emitEvent: false });
    this.clienteBusquedaTermino = this.resolveClienteNombre(cliente);
    this.clienteSearchLoading = false;

    this.loadTagsCliente();
    this.cdr.detectChanges();
  }

  limpiarBusqueda(): void {
    this.clienteSearchControl.setValue('', { emitEvent: false });
    this.clienteBusquedaTermino = '';
    this.dniCliente = '';
    this.clienteResultados = [];
    this.clienteSeleccionado = null;
    this.clienteSearchError = '';
    this.clienteSearchLoading = false;
    this.infoCliente = { nombre: '-', apellido: '-', celular: '-', correo: '-', documento: '-', direccion: '-', idCliente: 0, idUsuario: 0 };
    this.clienteSearchControl.enable({ emitEvent: false });
    this.visualizarService.selectAgregarPedido.doc = '';
    this.tagsCliente = [];
    this.tagsPedido = [];
  }

  private normalizeClienteTerm(value: string | ClienteBusquedaResultado | null | undefined): string {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return this.resolveClienteNombre(value).trim();
  }

  readonly clienteDisplayFn = (cliente: ClienteBusquedaResultado | string | null): string => {
    if (!cliente) {
      return '';
    }
    if (typeof cliente === 'string') {
      return cliente;
    }
    return this.resolveClienteNombre(cliente);
  };

  onClienteSelected(cliente: ClienteBusquedaResultado): void {
    this.seleccionarCliente(cliente);
  }

  private setInfoClienteFromResultado(cliente: ClienteBusquedaResultado): void {
    if (!cliente) {
      return;
    }

    const documento = this.resolveClienteDocumento(cliente);
    const contacto = this.resolveClienteContacto(cliente);
    const correo = this.resolveClienteCorreo(cliente);
    const ids = this.extractClienteIds(cliente);
    const nombrePreferido = this.resolveClienteNombre(cliente);
    const { nombre, apellido } = this.deriveNombreApellido(cliente, nombrePreferido);

    this.infoCliente = {
      nombre: nombre || '-',
      apellido: apellido || '-',
      celular: contacto || '-',
      correo: correo || '-',
      documento: documento || '-',
      direccion: (cliente.direccion as string) || '-',
      idCliente: ids.idCliente ?? 0,
      idUsuario: ids.idUsuario ?? 0
    };
  }

  resolveClienteNombre(cliente?: ClienteBusquedaResultado | null): string {
    if (!cliente) {
      return '';
    }
    return [
      cliente.nombreCompleto,
      cliente.nombre,
      cliente.razonSocial,
      cliente.contacto,
      cliente.email,
      cliente.correo
    ]
      .map(value => this.toOptionalString(value))
      .find(value => !!value) || '';
  }

  resolveClienteDocumento(cliente?: ClienteBusquedaResultado | null): string {
    if (!cliente) {
      return '';
    }
    return [
      cliente.doc,
      cliente.numeroDocumento,
      cliente.identificador,
      cliente.ruc,
      cliente.codigo,
      cliente.codigoCliente,
      cliente.id,
      cliente.idCliente
    ]
      .map(value => this.toOptionalString(value))
      .find(value => !!value) || '';
  }

  resolveClienteContacto(cliente?: ClienteBusquedaResultado | null): string {
    if (!cliente) {
      return '';
    }
    return [
      cliente.contacto,
      cliente.celular,
      cliente.telefono,
      cliente.whatsapp,
      cliente.email,
      cliente.correo
    ]
      .map(value => this.toOptionalString(value))
      .find(value => !!value) || '';
  }

  private resolveClienteCorreo(cliente?: ClienteBusquedaResultado | null): string {
    if (!cliente) {
      return '';
    }
    return [
      cliente.email,
      cliente.correo
    ]
      .map(value => this.toOptionalString(value))
      .find(value => !!value) || '';
  }

  private deriveNombreApellido(cliente: ClienteBusquedaResultado, fallback: string): { nombre: string; apellido: string } {
    const nombre = this.toOptionalString(cliente.nombre);
    const apellido = this.toOptionalString(cliente.apellido);

    if (nombre || apellido) {
      return {
        nombre: nombre || '',
        apellido: apellido || ''
      };
    }

    const base = this.toOptionalString(fallback);
    if (!base) {
      return { nombre: '', apellido: '' };
    }

    const tokens = base.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
      return { nombre: tokens[0], apellido: '' };
    }

    return {
      nombre: tokens.slice(0, -1).join(' '),
      apellido: tokens.slice(-1).join(' ')
    };
  }

  private extractClienteIds(cliente: ClienteBusquedaResultado): { idCliente?: number; idUsuario?: number } {
    const idCliente = this.parseNumberNullable(cliente.id ?? cliente.idCliente ?? cliente['clienteId']);
    const idUsuario = this.parseNumberNullable(cliente['idUsuario'] ?? cliente['usuarioId']);
    return { idCliente: idCliente ?? undefined, idUsuario: idUsuario ?? undefined };
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value == null) {
      return undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }

  private parseNumberNullable(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  get clienteNombreCompleto(): string {
    const nombre = this.toOptionalString(this.infoCliente?.nombre);
    const apellido = this.toOptionalString(this.infoCliente?.apellido);
    const texto = [nombre, apellido].filter(Boolean).join(' ').trim();
    return texto || '-';
  }

  // ====== Catálogos ======
  getServicio() {
    const obs = this.pedidoService.getServicios?.();
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getServicios] devolvió undefined o no-Observable');
      this.servicios = [];
      return;
    }
    obs.pipe(
      catchError((err: unknown) => {
        console.error('[getServicios] error dentro del stream', err);
        return of([]); // fallback
      })
    ).subscribe((responde: unknown) => {
      this.servicios = Array.isArray(responde) ? responde : [];
    });
  }

  asignarServicio(event: number) {
    this.servicioSeleccionado = event;
    this.getEventoxServicio();
  }

  getEventos() {
    const obs = this.pedidoService.getEventos?.();
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getEventos] devolvió undefined o no-Observable');
      this.evento = [];
      return;
    }
    obs.pipe(
      catchError((err: unknown) => {
        console.error('[getEventos] error dentro del stream', err);
        return of([]); // fallback
      })
    ).subscribe((responde: unknown) => {
      this.evento = Array.isArray(responde) ? responde : [];
    });
  }

  asignarEvento(event: number) {
    this.eventoSeleccionado = event;
    this.getEventoxServicio();
  }

  getEventoxServicio() {
    const obs = this.visualizarService?.getEventosServicio?.(this.eventoSeleccionado, this.servicioSeleccionado);
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getEventosServicio] devolvió undefined o no-Observable');
      this.paquetesRows = [];
      return;
    }
    obs.pipe(
      catchError((err: unknown) => {
        console.error('[getEventosServicio] error dentro del stream', err);
        return of([]); // fallback
      })
    ).subscribe((res: unknown) => {
      this.paquetesRows = Array.isArray(res)
        ? res.map(item => this.normalizePaqueteRow(item))
        : [];
    });
  }

  // ====== Selección de paquetes ======
  isInSeleccion(el: AnyRecord, eventoKey: string | number | null = this.currentEventoKey): boolean {
    const key = this.getPkgKey(el);
    return this.selectedPaquetes.some(p => p.key === key && p.eventKey === eventoKey);
  }

  addPaquete(el: AnyRecord, eventoKey: string | number | null = this.currentEventoKey) {
    if (this.isInSeleccion(el, eventoKey)) {
      Swal.fire({
        text: 'Ya seleccionaste este paquete para este evento.',
        icon: 'info',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-info' },
        buttonsStyling: false
      });
      return;
    }
    // console.log('addPaquete', { el, eventoKey });
    const record = this.asRecord(el);
    this.selectedPaquetes.push({
      key: this.getPkgKey(el),
      eventKey: eventoKey ?? null,
      ID: this.parseNumberNullable(record['idEventoServicio']),
      descripcion: String(record['descripcion'] ?? ''),
      precio: Number(record['precio'] ?? 0),
      cantidad: 1,
      notas: ''
    });
    this.refreshSelectedPaquetesColumns();
  }

  removePaquete(key: string | number | null, eventoKey: string | number | null = this.currentEventoKey) {
    this.selectedPaquetes = this.selectedPaquetes.filter(p => !(p.key === key && p.eventKey === eventoKey));
  }

  get totalSeleccion(): number {
    return this.selectedPaquetes.reduce((sum, p) => {
      const precio = Number(p.precio) || 0;
      const cantidad = Number(p.cantidad ?? 1) || 1;
      return sum + (precio * cantidad);
    }, 0);
  }

  // ====== Edición inline en tabla de ubicaciones ======
  startEdit(row: UbicacionRowEditable) {
    row._backup = { ...row };
    row._fechaPrev = row.Fecha;
    row.editing = true;
  }

  saveEdit(row: UbicacionRowEditable) {
    row.editing = false;
    delete row._backup;
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }

  cancelEdit(row: UbicacionRowEditable) {
    if (row._backup) {
      Object.assign(row, row._backup);
      delete row._backup;
    }
    row._fechaPrev = row.Fecha;
    row.editing = false;
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }

  // ====== Agregar / eliminar ubicaciones ======
  private getDiasTrabajo(): number | null {
    const raw = this.visualizarService.selectAgregarPedido?.dias;
    const parsed = this.parseNumberNullable(raw);
    return parsed != null && parsed >= 1 ? parsed : null;
  }

  private getFechasUbicacionUnicas(): string[] {
    const fechas = this.ubicacion
      .map(item => (item.Fecha ?? '').toString().trim())
      .filter(Boolean);
    return Array.from(new Set(fechas)).sort();
  }

  private formatFechaConDia(fecha: string): string {
    const parsed = parseDateInput(fecha);
    if (!parsed) {
      return fecha;
    }
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    const dia = dias[parsed.getDay()] ?? '';
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dia} ${dd}-${mm}-${yyyy}`;
  }

  isMultipleDias(): boolean {
    const parsed = this.getDiasTrabajo();
    return parsed != null && parsed > 1;
  }

  shouldShowFechaEvento(): boolean {
    const parsed = this.getDiasTrabajo();
    return parsed != null && parsed <= 1;
  }

  onDiasChange(value: unknown): void {
    const parsed = this.parseNumberNullable(value);
    this.visualizarService.selectAgregarPedido.dias = parsed != null ? Math.max(1, Math.floor(parsed)) : null;
    if (!this.isMultipleDias()) {
      this.selectedPaquetes = this.selectedPaquetes.map(item => ({ ...item, cantidad: 1 }));
    }
    if (this.isMultipleDias()) {
      this.visualizarService.selectAgregarPedido.fechaEvent = '';
    }
    this.refreshSelectedPaquetesColumns();
  }

  onUbicacionFechaChange(row: UbicacionRowEditable, value: unknown): void {
    const fecha = (value ?? '').toString().trim();
    if (!this.isMultipleDias() || !fecha) {
      row._fechaPrev = row.Fecha;
      return;
    }
    const maxDias = this.getDiasTrabajo();
    if (!maxDias) {
      row._fechaPrev = row.Fecha;
      return;
    }
    const fechasUnicas = this.getFechasUbicacionUnicas();
    if (fechasUnicas.length <= maxDias) {
      row._fechaPrev = row.Fecha;
      return;
    }
    const fechasPermitidas = fechasUnicas.filter(item => item !== fecha);
    const last = (row._fechaPrev ?? '').toString().trim();
    if (last && !fechasPermitidas.includes(last)) {
      fechasPermitidas.unshift(last);
    }
    const fechasTexto = fechasPermitidas.slice(0, maxDias);
    row.Fecha = row._fechaPrev ?? '';
    Swal.fire({
      icon: 'warning',
      title: 'Días ya definidos',
      html: `
        <p>Ya seleccionaste ${maxDias} día(s):</p>
        <ul class="text-start mb-0">
          ${fechasTexto.map(item => `<li>${this.formatFechaConDia(item)}</li>`).join('')}
        </ul>
      `,
      confirmButtonText: 'Entendido'
    });
  }

  get canAgregarEvento(): boolean {
    const diasTrabajo = this.getDiasTrabajo();
    const f = this.visualizarService.selectAgregarPedido.fechaEvent;
    const h = this.visualizarService.selectAgregarPedido.horaEvent;
    const u = (this.Direccion || '').trim();
    const dx = (this.DireccionExacta || '').trim();
    const requiereFecha = this.shouldShowFechaEvento();
    return !!(diasTrabajo && (!requiereFecha || f) && h && u && dx);
  }

  onQuickAdd() {
    if (!this.canAgregarEvento) return;
    this.addListUbicacion(
      this.Direccion,
      this.shouldShowFechaEvento() ? this.visualizarService.selectAgregarPedido.fechaEvent : '',
      this.visualizarService.selectAgregarPedido.horaEvent,
      this.DireccionExacta,
      this.NotasEvento
    );
    this.Direccion = '';
    this.DireccionExacta = '';
    this.NotasEvento = '';
  }

  addListUbicacion(direccion: string, fecha: string, hora: string, direccionExacta?: string, notas?: string) {
    const yaExiste = this.ubicacion.some(u =>
      u.Fecha === fecha &&
      u.Hora === hora &&
      this.norm(u.Direccion) === this.norm(direccion || '')
    );
    if (yaExiste) {
      Swal.fire({
        text: 'Ya existe un evento con la misma fecha, hora y ubicación.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }

    const cualEliminar = { ID: 0, Direccion: '' };
    this.ubicacion = this.ubicacion.filter((item) => {
      return item.ID != cualEliminar.ID && item.Direccion != cualEliminar.Direccion;
    });

    if (this.ubicacion.length < 8) {
      const i = this.ubicacion.length ? Math.max(...this.ubicacion.map(u => u.ID)) + 1 : 1;
      this.ubicacion.push({
        ID: i,
        Direccion: direccion,
        Fecha: fecha,
        Hora: hora,
        DireccionExacta: direccionExacta ?? '',
        Notas: notas ?? ''
      });
      this.dataSource.data = this.ubicacion; // ✅ no recrear
      this.bindSorts();
    }
  }

  onCantidadChange(paquete: PedidoPaqueteSeleccionado, value: unknown): void {
    const parsed = this.parseNumberNullable(value);
    paquete.cantidad = parsed != null && parsed >= 1 ? Math.floor(parsed) : 1;
  }

  private refreshSelectedPaquetesColumns(): void {
    const base: TableColumn<PedidoPaqueteSeleccionado>[] = [
      { key: 'descripcion', header: 'Descripción', sortable: false },
      { key: 'precio', header: 'Precio', sortable: false, class: 'text-end text-nowrap', width: '140px' }
    ];
    if (this.isMultipleDias()) {
      base.push({ key: 'cantidad', header: 'Cant.', sortable: false, class: 'text-center', width: '90px' });
    }
    base.push(
      { key: 'subtotal', header: 'Subtotal', sortable: false, class: 'text-end text-nowrap', width: '140px' },
      { key: 'notas', header: 'Notas', sortable: false, filterable: false, width: '280px' },
      { key: 'quitar', header: 'Quitar', sortable: false, filterable: false, class: 'text-center', width: '90px' }
    );
    this.selectedPaquetesColumns = base;
  }

  private resetFormState(): void {
    this.fechaCreate = new Date();
    this.visualizarService.selectAgregarPedido = {
      NombrePedido: '',
      ExS: 0,
      doc: '',
      fechaCreate: formatDisplayDate(this.fechaCreate, ''),
      fechaEvent: '',
      horaEvent: '',
      dias: null,
      CodEmp: 0,
      Direccion: '',
      Observacion: ''
    };
    this.fechaValidate(this.fechaCreate);

    this.Direccion = '';
    this.DireccionExacta = '';
    this.NotasEvento = '';

    this.infoCliente = { nombre: '-', apellido: '-', celular: '-', correo: '-', documento: '-', direccion: '-', idCliente: 0, idUsuario: 0 };
    this.dniCliente = '';
    this.clienteSeleccionado = null;
    this.clienteResultados = [];
    this.clienteBusquedaTermino = '';
    this.clienteSearchError = '';
    this.clienteSearchLoading = false;
    this.clienteSearchControl.setValue('', { emitEvent: false });

    this.ubicacion = [{ ID: 0, Direccion: '', Fecha: '', Hora: '', DireccionExacta: '', Notas: '' }];
    this.dataSource.data = this.ubicacion;

    this.selectedPaquetes = [];
    this.currentEventoKey = null;
    this.tagsPedido = [];
    this.tagsCliente = [];
    this.refreshSelectedPaquetesColumns();
  }

  async deleteElement(p: string, c: string) {
    const fila = this.ubicacion.find(x => x.Hora == c && x.Direccion == p);
    const { isConfirmed } = await Swal.fire({
      title: '¿Eliminar ubicación?',
      html: `<div style="text-align:left">
            <b>Fecha:</b> ${fila?.Fecha || '-'}<br>
            <b>Hora:</b> ${fila?.Hora || '-'}<br>
            <b>Ubicación:</b> ${fila?.Direccion || '-'}
           </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      customClass: { confirmButton: 'btn btn-danger', cancelButton: 'btn btn-secondary' },
      buttonsStyling: false
    });

    if (!isConfirmed) return;

    const idx = this.ubicacion.findIndex(x => x.Hora == c && x.Direccion == p);
    if (idx >= 0) {
      this.ubicacion.splice(idx, 1);
      this.dataSource.data = this.ubicacion; // ✅ no recrear
      this.bindSorts();
    }
  }

  drop(event: CdkDragDrop<AnyRecord[]>) {
    moveItemInArray(this.ubicacion, event.previousIndex, event.currentIndex);
    // crea nueva referencia para que Angular detecte el cambio
    this.ubicacion = [...this.ubicacion];
    this.dataSource.data = this.ubicacion; // ✅ no recrear
    this.bindSorts();
  }

  // ====== Enviar ======
  postPedido() {
    if (!this.infoCliente?.idCliente) {
      Swal.fire({
        text: 'Selecciona un cliente existente antes de registrar.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }
    const diasTrabajo = this.getDiasTrabajo();
    if (diasTrabajo == null) {
      Swal.fire({
        text: 'Selecciona la cantidad de días del evento.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }
    // ====== Validaciones previas ======
    const primera = this.ubicacion.find(u => (u?.Direccion || '').trim());
    if (!primera) {
      Swal.fire({
        text: 'Agrega al menos una ubicación válida antes de registrar.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }
    if (diasTrabajo > 1) {
      const fechasUnicas = new Set(
        (this.ubicacion || [])
          .map(u => String(u.Fecha || '').trim())
          .filter(Boolean)
      );
      if (fechasUnicas.size < diasTrabajo) {
        Swal.fire({
          text: `Para ${diasTrabajo} días de trabajo debes registrar al menos ${diasTrabajo} fechas diferentes en las locaciones.`,
          icon: 'warning',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-warning' },
          buttonsStyling: false
        });
        return;
      }
    }

    if (!this.selectedPaquetes?.length) {
      Swal.fire({
        text: 'Selecciona al menos un paquete/ítem antes de registrar.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }



    // ====== Formatos canónicos ======
    // fechaCreate: aseguramos YYYY-MM-DD (sin locale)
    const fechaCreacion = this.convert(this.fechaCreate); // ya retorna YYYY-MM-DD

    // Normalizador de hora: HH:mm -> HH:mm:ss
    const toHms = (h: string | null | undefined) =>
      (h || '').length === 5 ? `${h}:00` : (h || '');

    // ====== Construcción del payload compuesto ======
    const payload = {
      pedido: {
        clienteId: this.infoCliente.idCliente,
        empleadoId: this.CodigoEmpleado ?? 1,
        fechaCreacion: fechaCreacion,
        observaciones: this.visualizarService.selectAgregarPedido?.Observacion || '',
        // Define estos IDs iniciales en tu back; aquí puedes setearlos fijo o obtenerlos antes
        estadoPedidoId: 1, // Ej: 1 = Pendiente
        estadoPagoId: 1,   // Ej: 1 = Sin pago
        nombrePedido: this.visualizarService.selectAgregarPedido?.NombrePedido || ''
      },
      eventos: (this.ubicacion || [])
        .filter(u => (u?.Direccion || '').trim())
        .map(u => ({
          fecha: String(u.Fecha || '').trim(),            // YYYY-MM-DD
          hora: toHms(String(u.Hora || '').trim()),       // HH:mm:ss
          ubicacion: String(u.Direccion || '').trim(),    // nombre corto/lugar
          direccion: String(u.DireccionExacta || '').trim(), // dirección exacta
          notas: String(u.Notas || '').trim()
        })),
      items: (this.selectedPaquetes || []).map(it => ({
        exsId: it.ID ?? null,                    // FK_ExS_Cod si proviene de catálogo
        eventoCodigo: null,                      // Si luego asocias al evento, coloca el PK_PE_Cod
        moneda: 'USD',                           // Cambia a 'USD' si corresponde
        nombre: String(it.descripcion || '').trim(),
        descripcion: String(it.descripcion || '').trim(),
        precioUnit: Number(it.precio || 0),
        cantidad: Number(it.cantidad ?? 1),
        descuento: 0,
        recargo: 0,
        notas: String(it.notas || '').trim()
      }))
    };

    // ====== Validaciones de coherencia (extra) ======
    if (!payload.eventos.length) {
      Swal.fire({
        text: 'Debes registrar al menos un evento (fecha, hora y ubicación).',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }
    const horaInvalida = payload.eventos.some(e => !/^\d{2}:\d{2}:\d{2}$/.test(e.hora));
    const fechaInvalida = payload.eventos.some(e => !/^\d{4}-\d{2}-\d{2}$/.test(e.fecha));
    if (horaInvalida || fechaInvalida) {
      Swal.fire({
        text: 'Revisa el formato de fecha (YYYY-MM-DD) y hora (HH:mm:ss) en los eventos.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }

    // ====== Logs para inspección ======
    console.table(payload.eventos);
    console.table(payload.items);

    // ====== Envío ======
    this.visualizarService.postPedidos(payload).subscribe(
      () => {
        Swal.fire({
          text: 'Registro exitoso',
          icon: 'success',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-success' },
          buttonsStyling: false
        });
      },
      (err) => {
        console.error('[postPedidos] error', err);
        Swal.fire({
          text: 'Ocurrió un error, volver a intentar.',
          icon: 'warning',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-warning' },
          buttonsStyling: false
        });
      }
    );
  }

  private normalizePaqueteRow(item: unknown): PaqueteRow {
    const record = this.asRecord(item);
    const precio = Number(record['precio'] ?? record['Precio']);
    const staff = Number(record['staff'] ?? record['Staff'] ?? record['personal'] ?? record['Personal']);
    const horas = Number(record['horas'] ?? record['Horas'] ?? record['duration'] ?? record['Duracion']);

    return {
      descripcion: String(record['descripcion'] ?? record['Descripcion'] ?? record['titulo'] ?? 'Paquete'),
      precio: Number.isFinite(precio) ? precio : null,
      staff: Number.isFinite(staff) ? staff : null,
      horas: Number.isFinite(horas) ? horas : null,
      raw: record
    };
  }
}

interface PaqueteRow {
  descripcion: string;
  precio: number | null;
  staff: number | null;
  horas: number | null;
  raw: AnyRecord;
}
