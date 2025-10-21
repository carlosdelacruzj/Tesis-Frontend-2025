import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { PedidoService } from '../service/pedido.service';
import { VisualizarService } from '../service/visualizar.service';
import swal from 'sweetalert2';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSort } from '@angular/material/sort';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  selector: 'app-agregar-pedido',
  templateUrl: './agregar-pedido.component.html',
  styleUrls: ['./agregar-pedido.component.css']
})
export class AgregarPedidoComponent implements OnInit, AfterViewInit {
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

  // ⚠️ Inicializados para que nunca sean undefined
  dataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);
  paquetesRows: PaqueteRow[] = [];

  // ====== MatSort (2 tablas)
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
  ubicacion = [{ ID: 0, Direccion: '', Fecha: '', Hora: '', DireccionExacta: '', Notas: '' }];

  // ====== Paquetes seleccionados ======
  selectedPaquetes: PedidoPaqueteSeleccionado[] = [];
  desID = 0;
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

  constructor(
    public pedidoService: PedidoService,
    public visualizarService: VisualizarService,
  ) { }

  // ====== Ciclo de vida ======
  ngOnInit(): void {
    this.getEventos();
    this.getServicio();
    this.getEventoxServicio();

    this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(this.fechaCreate, '');
    this.fechaValidate(this.fechaCreate);

    if (this.dniCliente) this.loadTagsCliente();
  }

  ngAfterViewInit(): void {
    // Enlaza sorts cuando ya existen las vistas
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
    return el?.ID ?? el?.PK_ExS_Cod ?? el?.pk ?? `${(el?.descripcion || '').trim()}|${el?.precio}`;
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
  fechaValidate(date) {
    this.minimo = this.addDaysToDate(date, -10);
    this.maximo = this.addDaysToDate(date, 365);
  }

  convert(str) {
    var date = new Date(str),
      mnth = ('0' + (date.getMonth() + 1)).slice(-2),
      day = ('0' + date.getDate()).slice(-2);
    return [date.getFullYear(), mnth, day].join('-');
  }

  addDaysToDate(date, days) {
    var res = new Date(date);
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
      if (res.length == 0) {
        this.infoCliente;
      } else {
        this.infoCliente = res[0];
        // console.log('dni', dni);
        // console.log('infoCliente', this.infoCliente);
        this.loadTagsCliente();
      }
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
    return this.selectedPaquetes.some(p => p.key === key && p.eventKey === eventoKey);
  }

  addPaquete(el: any, eventoKey: any = this.currentEventoKey) {
    if (this.isInSeleccion(el, eventoKey)) {
      swal.fire({
        text: 'Ya seleccionaste este paquete para este evento.',
        icon: 'info',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-info' },
        buttonsStyling: false
      });
      return;
    }
    // console.log('addPaquete', { el, eventoKey });
    this.selectedPaquetes.push({
      key: this.getPkgKey(el),
      eventKey: eventoKey ?? null,
      ID: el.idEventoServicio,
      descripcion: el.descripcion,
      precio: el.precio,
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
    const f = this.visualizarService.selectAgregarPedido.fechaEvent;
    const h = this.visualizarService.selectAgregarPedido.horaEvent;
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
    } else {
      this.ubicacion;
    }
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
      this.dataSource.data = this.ubicacion; // ✅ no recrear
      this.bindSorts();
    }
  }

  drop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.ubicacion, event.previousIndex, event.currentIndex);
    // crea nueva referencia para que Angular detecte el cambio
    this.ubicacion = [...this.ubicacion];
    this.dataSource.data = this.ubicacion; // ✅ no recrear
    this.bindSorts();
  }

  // ====== Enviar ======
  postPedido() {
    if (!this.dniCliente) {
      swal.fire({
        text: 'Ingresa el DNI del cliente.',
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
      swal.fire({
        text: 'Agrega al menos una ubicación válida antes de registrar.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }

    if (!this.selectedPaquetes?.length) {
      swal.fire({
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
        cantidad: 1,
        descuento: 0,
        recargo: 0,
        notas: String(it.notas || '').trim()
      }))
    };

    // ====== Validaciones de coherencia (extra) ======
    if (!payload.eventos.length) {
      swal.fire({
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
      swal.fire({
        text: 'Revisa el formato de fecha (YYYY-MM-DD) y hora (HH:mm:ss) en los eventos.',
        icon: 'warning',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-warning' },
        buttonsStyling: false
      });
      return;
    }

    // ====== Logs para inspección ======
    console.log('%c[POST PEDIDO] payload compuesto', 'color:#0b7285;font-weight:bold;');
    console.log(JSON.stringify(payload, null, 2));
    console.table(payload.eventos);
    console.table(payload.items);

    // ====== Envío ======
    this.visualizarService.postPedidos(payload).subscribe(
      (res) => {
        swal.fire({
          text: 'Registro exitoso',
          icon: 'success',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-success' },
          buttonsStyling: false
        });
      },
      (err) => {
        console.error('[postPedidos] error', err);
        swal.fire({
          text: 'Ocurrió un error, volver a intentar.',
          icon: 'warning',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-warning' },
          buttonsStyling: false
        });
      }
    );
  }

  private normalizePaqueteRow(item: any): PaqueteRow {
    const precio = Number(item?.precio ?? item?.Precio);
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
