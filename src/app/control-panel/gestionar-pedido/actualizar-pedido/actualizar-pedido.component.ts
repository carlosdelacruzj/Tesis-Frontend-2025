import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { PedidoService } from '../service/pedido.service';
import { VisualizarService } from '../service/visualizar.service';
import swal from 'sweetalert2';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSort } from '@angular/material/sort';
import { of, take, finalize } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { formatDisplayDate, parseDateInput } from '../../../shared/utils/date-utils';
import { TableColumn } from 'src/app/components/table/table-base.component';

type Tag = { nombre: string; direccion: string; usedAt?: number };
type PedidoPaqueteSeleccionado = {
  key: string | number;
  eventKey: string | number | null;
  ID?: number;
  descripcion: string;
  precio: number;
  notas: string;
};

@Component({
  selector: 'app-actualizar-pedido',
  templateUrl: './actualizar-pedido.component.html',
  styleUrls: ['./actualizar-pedido.component.css']
})
export class ActualizarPedidoComponent implements OnInit, AfterViewInit {
  saving = false;
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
  servicios: any[] = [];
  evento: any[] = [];
  servicioSeleccionado = 1;
  eventoSeleccionado = 1;

  dataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);
  paquetesRows: PaqueteRow[] = [];

  @ViewChild('sortUbic') sortUbic!: MatSort;

  private bindSorts() {
    if (this.sortUbic) this.dataSource.sort = this.sortUbic;
  }

  // ====== Estado general ======
  CodigoEmpleado: number = 1;
  infoCliente = { nombre: '-', apellido: '-', celular: '-', correo: '-', documento: '-', direccion: '-', idCliente: 0, idUsuario: 0 };
  dniCliente: any;

  // ====== Evento actual (inputs) ======
  Direccion: any;
  DireccionExacta: string = '';
  NotasEvento: string = '';

  // ====== Fechas ======
  fechaCreate: Date = new Date();
  minimo: string;
  maximo: string;

  // ====== Ubicaciones ======
  ubicacion = [{ ID: 0, dbId: 0, Direccion: '', Fecha: '', Hora: '', DireccionExacta: '', Notas: '' }];

  // ====== Paquetes seleccionados ======
  selectedPaquetes: PedidoPaqueteSeleccionado[] = [];
  currentEventoKey: string | number | null = null;
  selectedPaquetesColumns: TableColumn<PedidoPaqueteSeleccionado>[] = [
    { key: 'descripcion', header: 'Descripción', sortable: false },
    { key: 'precio', header: 'Precio', sortable: false, class: 'text-end text-nowrap', width: '140px' },
    { key: 'cantidad', header: 'Cant.', sortable: false, class: 'text-center', width: '90px' },
    { key: 'subtotal', header: 'Subtotal', sortable: false, class: 'text-end text-nowrap', width: '140px' },
    { key: 'notas', header: 'Notas', sortable: false, filterable: false, width: '280px' },
    { key: 'quitar', header: 'Quitar', sortable: false, filterable: false, class: 'text-center', width: '90px' }
  ];

  // ====== TAGS ======
  tagsPedido: Tag[] = [];
  tagsCliente: Tag[] = [];

  // ====== Pedido actual ======
  private pedidoId!: number;

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

  get clienteNombreCompleto(): string {
    const nombre = this.toOptionalString(this.infoCliente?.nombre);
    const apellido = this.toOptionalString(this.infoCliente?.apellido);
    const texto = [nombre, apellido].filter(Boolean).join(' ').trim();
    return texto || '-';
  }

  get clienteDocumento(): string {
    return (
      this.toOptionalString(this.infoCliente?.documento) ??
      this.toOptionalString(this.dniCliente) ??
      '-'
    );
  }

  get clienteCelular(): string {
    return this.toOptionalString(this.infoCliente?.celular) ?? '-';
  }

  constructor(
    public pedidoService: PedidoService,
    public visualizarService: VisualizarService,
    private route: ActivatedRoute,
    private router: Router,
  ) { }

  // ====== Ciclo de vida ======
  ngOnInit(): void {
    this.pedidoId = +(this.route.snapshot.paramMap.get('id') || 0);
    if (!this.pedidoId) {
      swal.fire({
        text: 'ID de pedido inválido.',
        icon: 'error',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-danger' },
        buttonsStyling: false
      });
      this.router.navigate(['/home/gestionar-pedido']);
      return;
    }

    this.getEventos();
    this.getServicio();
    this.getEventoxServicio();

    // Inicializa cabecera
    // this.visualizarService.selectAgregarPedido = this.visualizarService.selectAgregarPedido ?? {};
    this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(this.fechaCreate, '');
    this.fechaValidate(this.fechaCreate);

    // Cargar el pedido existente
    this.loadPedido(this.pedidoId);
  }

  ngAfterViewInit(): void {
    this.bindSorts();
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

  private getPkgKey(el: any): string | number {
    return (
      el?.ID ??
      el?.idEventoServicio ??   // catálogo
      el?.exsId ??              // items desde BD
      el?.PK_ExS_Cod ??         // por si viene con este nombre
      `${(el?.descripcion ?? el?.nombre ?? '').trim()}|${el?.precio ?? el?.precioUnit ?? 0}`
    );
  }
  public pkgKey = (el: any) => this.getPkgKey(el);

  get canGuardarTag(): boolean {
    const u = this.norm(this.Direccion);
    const dx = (this.DireccionExacta || '').trim();
    return !!(u && dx && dx.length >= 8);
  }

  loadTagsCliente() {
    try {
      const raw = localStorage.getItem(this.tagStorageKey);
      this.tagsCliente = raw ? JSON.parse(raw) : [];
    } catch {
      this.tagsCliente = [];
    }
  }

  saveTagsCliente() {
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
  fechaValidate(date: Date) {
    this.minimo = this.addDaysToDate(date, -365); // al editar, permitimos historial más amplio
    this.maximo = this.addDaysToDate(date, 365);
  }

  convert(strOrDate: string | Date) {
    const date = new Date(strOrDate);
    const mnth = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return [date.getFullYear(), mnth, day].join('-');
  }

  addDaysToDate(date: Date, days: number) {
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

  rowInvalid(row: any): boolean {
    const fechaOk = !!row.Fecha;
    const horaOk = !!row.Hora;
    const dex = (row.DireccionExacta || '').trim();
    const direccionOk = !!(row.Direccion && row.Direccion.trim());
    const dexOk = dex.length >= 8;
    return !(fechaOk && horaOk && direccionOk && dexOk);
  }

  // ====== Cliente ======
  getDataCliente(dni: number) {
    const obs: any = this.pedidoService.getDni?.(dni);
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getDni] devolvió undefined o no-Observable');
      return;
    }
    obs.pipe(
      catchError((err: any) => {
        console.error('[getDni] error dentro del stream', err);
        return of([]); // fallback
      })
    ).subscribe((res: any) => {
      if (!res?.length) return;
      this.infoCliente = res[0];
      this.loadTagsCliente();
    });
  }

  buscarCliente(dni: number) {
    this.getDataCliente(dni);
  }

  // ====== Catálogos ======
  getServicio() {
    const obs: any = this.pedidoService.getServicios?.();
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getServicios] devolvió undefined o no-Observable');
      this.servicios = [];
      return;
    }
    obs.pipe(
      catchError((err: any) => {
        console.error('[getServicios] error dentro del stream', err);
        return of([]); // fallback
      })
    ).subscribe((responde: any) => {
      this.servicios = responde ?? [];
    });
  }

  asignarServicio(event: number) {
    this.servicioSeleccionado = event;
    this.getEventoxServicio();
  }

  getEventos() {
    const obs: any = this.pedidoService.getEventos?.();
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getEventos] devolvió undefined o no-Observable');
      this.evento = [];
      return;
    }
    obs.pipe(
      catchError((err: any) => {
        console.error('[getEventos] error dentro del stream', err);
        return of([]); // fallback
      })
    ).subscribe((responde: any) => {
      this.evento = responde ?? [];
    });
  }

  asignarEvento(event: number) {
    this.eventoSeleccionado = event;
    this.getEventoxServicio();
  }

  getEventoxServicio() {
    const obs: any = this.visualizarService?.getEventosServicio?.(this.eventoSeleccionado, this.servicioSeleccionado);
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getEventosServicio] devolvió undefined o no-Observable');
      this.paquetesRows = [];
      return;
    }
    obs.pipe(
      catchError((err: any) => {
        console.error('[getEventosServicio] error dentro del stream', err);
        return of([]); // fallback
      })
    ).subscribe((res: any) => {
      this.paquetesRows = Array.isArray(res)
        ? res.map(item => this.normalizePaqueteRow(item))
        : [];
    });
  }

  // ====== Selección de paquetes ======
  isInSeleccion(el: any, eventoKey: any = this.currentEventoKey): boolean {
    const key = this.getPkgKey(el);
    const ek = eventoKey ?? null;
    return this.selectedPaquetes.some(p => p.key === key && (p.eventKey ?? null) === ek);
  }

  // addPaquete(el: any, eventoKey: any = this.currentEventoKey) {
  //   if (this.isInSeleccion(el, eventoKey)) { /* ... */ return; }
  //   this.selectedPaquetes.push({
  //     key: this.getPkgKey(el),
  //     eventKey: eventoKey ?? null,
  //     ID: el.idEventoServicio ?? el.exsId ?? el.PK_ExS_Cod ?? null, // ← consistente
  //     descripcion: el.descripcion ?? el.nombre ?? '',
  //     precio: Number(el.precio ?? el.precioUnit ?? 0),
  //     notas: ''
  //   });
  // }

  addPaquete(el: any, eventoKey: any = this.currentEventoKey) {
    if (this.isInSeleccion(el, eventoKey)) {
      // ...
      return;
    }
    this.selectedPaquetes.push({
      key: this.getPkgKey(el),
      eventKey: eventoKey ?? null,
      ID: el.idEventoServicio ?? el.exsId ?? el.PK_ExS_Cod ?? null, // <-- FK consistente
      descripcion: el.descripcion ?? el.nombre ?? '',
      precio: Number(el.precio ?? el.precioUnit ?? 0),
      notas: ''
    });
  }
  removePaquete(key: any, eventoKey: any = this.currentEventoKey) {
    this.selectedPaquetes = this.selectedPaquetes.filter(p => !(p.key === key && p.eventKey === eventoKey));
  }

  get totalSeleccion(): number {
    return this.selectedPaquetes.reduce((sum, p) => sum + (+p.precio || 0), 0);
  }

  // ====== Edición inline en tabla de ubicaciones ======
  startEdit(row: any) {
    row._backup = { ...row };
    row.editing = true;
  }

  saveEdit(row: any) {
    row.editing = false;
    delete row._backup;
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }

  cancelEdit(row: any) {
    Object.assign(row, row._backup);
    row.editing = false;
    delete row._backup;
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }

  // ====== Agregar / eliminar ubicaciones ======
  get canAgregarEvento(): boolean {
    const f = this.visualizarService.selectAgregarPedido?.fechaEvent;
    const h = this.visualizarService.selectAgregarPedido?.horaEvent;
    const u = (this.Direccion || '').trim();
    const dx = (this.DireccionExacta || '').trim();
    return !!(f && h && u && dx);
  }

  onQuickAdd() {
    if (!this.canAgregarEvento) return;
    this.addListUbicacion(
      this.Direccion,
      this.visualizarService.selectAgregarPedido.fechaEvent,
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
      swal.fire({
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

    const i = this.ubicacion.length ? Math.max(...this.ubicacion.map(u => u.ID)) + 1 : 1;
    this.ubicacion.push({
      ID: i,
      dbId: 0,
      Direccion: direccion,
      Fecha: fecha,
      Hora: hora,
      DireccionExacta: direccionExacta ?? '',
      Notas: notas ?? ''
    });
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }

  async deleteElement(p: any, c: any) {
    const fila = this.ubicacion.find(x => x.Hora == c && x.Direccion == p);
    const { isConfirmed } = await swal.fire({
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
      this.dataSource.data = this.ubicacion;
      this.bindSorts();
    }
  }

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.ubicacion, event.previousIndex, event.currentIndex);
    this.ubicacion = [...this.ubicacion];
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }

  // ====== Carga del pedido existente ======
  private loadPedido(id: number) {
    const obs: any = this.visualizarService.getPedidoById?.(id);
    if (!obs || typeof obs.subscribe !== 'function') {
      console.error('[getPedidoById] no disponible');
      return;
    }

    obs.pipe(
      catchError((err: any) => {
        console.error('[getPedidoById] error', err);
        swal.fire({
          text: 'No se pudo cargar el pedido.',
          icon: 'error',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-danger' },
          buttonsStyling: false
        });
        return of(null);
      })
    ).subscribe((data: any) => {
      if (!data) return;
      console.log('Pedido cargado:', data);
      console.log('Pedido (raw):', data.pedido || data);


      // === Mapear cabecera ===
      // Ajusta nombres según tu DTO real
      const cab = data.pedido || data;
      this.visualizarService.selectAgregarPedido.NombrePedido = cab?.nombrePedido ?? cab?.nombre ?? '';
      this.visualizarService.selectAgregarPedido.Observacion = cab?.observaciones ?? '';
      this.CodigoEmpleado = cab?.empleadoId ?? this.CodigoEmpleado;
      this.fechaCreate = new Date(cab?.fechaCreacion ?? new Date());
      this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(this.fechaCreate, '');

      // Cliente
      this.infoCliente = {
        nombre: cab?.cliente?.nombres ?? '-',
        apellido: cab?.cliente?.apellidos ?? '-',
        celular: cab?.cliente?.celular ?? '-',
        correo: cab?.cliente?.correo ?? '-',
        documento: cab?.cliente?.documento ?? '-',
        direccion: cab?.cliente?.direccion ?? '-',
        idCliente: cab?.clienteId ?? cab?.cliente?.id ?? 0,
        idUsuario: 0
      };
      this.dniCliente = this.infoCliente.documento || '';

      // === Mapear eventos ===
      const eventos = data.eventos ?? cab?.eventos ?? [];
      // Normaliza a {ID, Direccion, Fecha, Hora, DireccionExacta, Notas}
      // this.ubicacion = (Array.isArray(eventos) ? eventos : []).map((e: any, idx: number) => ({
      //   ID: idx + 1,
      //   Direccion: e.ubicacion ?? e.lugar ?? '',
      //   Fecha: (e.fecha ? String(e.fecha).slice(0, 10) : ''),
      //   Hora: (e.hora ? String(e.hora).slice(0, 5) : ''), // HH:mm[:ss] -> HH:mm
      //   DireccionExacta: e.direccion ?? '',
      //   Notas: e.notas ?? ''
      // }));
      this.ubicacion = (data.eventos || []).map((e: any, idx: number) => ({
        ID: idx + 1,                 // solo para la tabla
        dbId: e.id ?? e.dbId ?? 0,  // <-- toma el id real
        Direccion: e.ubicacion ?? '',
        Fecha: String(e.fecha).slice(0, 10),
        Hora: String(e.hora).slice(0, 5),
        DireccionExacta: e.direccion ?? '',
        Notas: e.notas ?? ''
      }));
      console.log('Eventos mapeados:', this.ubicacion);
      this.dataSource.data = this.ubicacion;
      this.bindSorts();

      // Precargar controles "Fecha/Hora" superiores con el primer evento (UX)
      const first = this.ubicacion[0];
      if (first) {
        this.visualizarService.selectAgregarPedido.fechaEvent = first.Fecha;
        this.visualizarService.selectAgregarPedido.horaEvent = first.Hora;
      }

      // === Mapear items/paquetes ===
      const items = data.items ?? cab?.items ?? [];
      // this.selectedPaquetes = (Array.isArray(items) ? items : []).map((it: any) => ({
      //   key: this.getPkgKey(it),                         // ahora sí dará el mismo valor que en el catálogo
      //   eventKey: it.eventoCodigo ?? null,               // si asocias por evento
      //   ID: it.exsId ?? it.id ?? null,                   // importante: conserva el ID del paquete
      //   descripcion: it.nombre ?? it.descripcion ?? '',
      //   precio: Number(it.precioUnit ?? it.precio ?? 0), // normaliza precio
      //   notas: it.notas ?? ''
      // }));
      this.selectedPaquetes = (data.items || []).map((it: any) => ({
        id: it.id,                                       // <-- PK_PS_Cod real
        key: this.getPkgKey(it),                         // <-- clave consistente
        eventKey: it.eventoCodigo ?? null,               // si asocias por evento
        ID: it.exsId ?? it.id ?? null,                   // FK a T_EventoServicio
        descripcion: it.nombre ?? it.descripcion ?? '',
        precio: Number(it.precioUnit ?? it.precio ?? 0),
        notas: it.notas ?? ''
      }));
      // Cargar tags del cliente (si procede)
      if (this.dniCliente) this.loadTagsCliente();
    });
  }

  // ====== Enviar actualización ======


  updatePedido() {
    if (this.saving) return;              // ← evita doble click
    if (!this.pedidoId) return;

    if (!this.infoCliente?.idCliente) {
      swal.fire({
        text: 'El pedido debe tener un cliente válido.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }

    if (!this.ubicacion?.length || !this.ubicacion.some(u => (u?.Direccion || '').trim())) {
      swal.fire({
        text: 'Agrega al menos una ubicación válida antes de actualizar.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }

    if (!this.selectedPaquetes?.length) {
      swal.fire({
        text: 'Selecciona al menos un paquete/ítem antes de actualizar.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }

    const fechaCreacion = this.convert(this.fechaCreate);
    const toHms = (h: string | null | undefined) => (h || '').length === 5 ? `${h}:00` : (h || '');

    const payload = {
      pedido: {
        id: this.pedidoId,
        clienteId: this.infoCliente.idCliente,
        empleadoId: this.CodigoEmpleado ?? 1,
        fechaCreacion: fechaCreacion,
        observaciones: this.visualizarService.selectAgregarPedido?.Observacion || '',
        estadoPedidoId: 1,
        estadoPagoId: 1,
        nombrePedido: this.visualizarService.selectAgregarPedido?.NombrePedido || ''
      },
      eventos: (this.ubicacion || [])
        .filter(u => (u?.Direccion || '').trim())
        .map(u => ({
          id: (u.dbId ?? u.ID ?? null),
          fecha: String(u.Fecha || '').trim(),
          hora: toHms(String(u.Hora || '').trim()),
          ubicacion: String(u.Direccion || '').trim(),
          direccion: String(u.DireccionExacta || '').trim(),
          notas: String(u.Notas || '').trim()
        })),
      items: (this.selectedPaquetes || []).map(it => ({
        // id: it.id ?? null,
        exsId: it.ID ?? null,
        eventoCodigo: null,
        moneda: 'USD',
        nombre: String(it.descripcion || '').trim(),
        descripcion: String(it.descripcion || '').trim(),
        precioUnit: Number(it.precio || 0),
        cantidad: 1,
        descuento: 0,
        recargo: 0,
        notas: String(it.notas || '').trim()
      }))
    };

    // Validación de formatos ANTES de activar el candado
    const horaInvalida = payload.eventos.some(e => !/^\d{2}:\d{2}:\d{2}$/.test(e.hora));
    const fechaInvalida = payload.eventos.some(e => !/^\d{4}-\d{2}-\d{2}$/.test(e.fecha));
    if (horaInvalida || fechaInvalida) {
      swal.fire({
        text: 'Revisa el formato de fecha (YYYY-MM-DD) y hora (HH:mm:ss) en los eventos.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }

    // Logs
    console.log('%c[PUT PEDIDO] payload compuesto', 'color:#5c940d;font-weight:bold;');
    console.log(JSON.stringify(payload, null, 2));

    const obs: any = this.visualizarService.updatePedido?.(this.pedidoId, payload);
    if (!obs || typeof obs.subscribe !== 'function') {
      console.error('[updatePedido] no disponible');
      swal.fire({
        text: 'No se pudo enviar la actualización.',
        icon: 'error',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-danger' },
        buttonsStyling: false
      });
      return;
    }
    // Mostrar loading inmediatamente después de confirmar que obs existe
    swal.fire({
      title: 'Actualizando...',
      text: 'Por favor espera unos segundos',
      allowOutsideClick: false,
      didOpen: () => {
        swal.showLoading();
      }
    });
    this.saving = true; // ← activa el candado SOLO cuando ya vas a llamar al API

    obs.pipe(
      take(1),
      finalize(() => { this.saving = false; }) // ← libéralo siempre
    ).subscribe(
      (res: any) => {
        swal.fire({
          text: 'Pedido actualizado correctamente.',
          icon: 'success',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-success' },
          buttonsStyling: false
        });
        // this.router.navigate(['/home/gestionar-pedido']);
      },
      (err: any) => {
        console.error('[updatePedido] error', err);
        swal.fire({
          text: 'Ocurrió un error al actualizar, vuelve a intentar.',
          icon: 'warning',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-warning' },
          buttonsStyling: false
        });
      }
    );
  }

  private normalizePaqueteRow(item: any): PaqueteRow {
    const precio = Number(item?.precio ?? item?.Precio ?? item?.precioUnit ?? item?.precio_unitario);
    const staff = Number(item?.staff ?? item?.Staff ?? item?.personal ?? item?.Personal);
    const horas = Number(item?.horas ?? item?.Horas ?? item?.duration ?? item?.Duracion);

    return {
      descripcion: item?.descripcion ?? item?.Descripcion ?? item?.titulo ?? 'Paquete',
      precio: Number.isFinite(precio) ? precio : null,
      staff: Number.isFinite(staff) ? staff : null,
      horas: Number.isFinite(horas) ? horas : null,
      raw: item
    };
  }
}

interface PaqueteRow {
  descripcion: string;
  precio: number | null;
  staff: number | null;
  horas: number | null;
  raw: any;
}
