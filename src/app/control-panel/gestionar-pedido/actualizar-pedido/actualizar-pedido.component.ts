import { Component, OnInit, ViewChild, AfterViewInit, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { PedidoService } from '../service/pedido.service';
import { VisualizarService } from '../service/visualizar.service';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSort } from '@angular/material/sort';
import { of, take, finalize, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { formatDisplayDate, parseDateInput } from '../../../shared/utils/date-utils';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { PedidoResponse, PedidoUpdatePayload } from '../model/visualizar.model';

type AlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

interface PedidoPaqueteSeleccionado {
  key: string | number;
  eventKey: string | number | null;
  tmpId: string;
  id?: number;
  idEventoServicio?: number | null;
  eventoId?: number | null;
  servicioId?: number | null;
  nombre?: string;
  titulo: string;
  descripcion: string;
  precioUnit?: number;
  precio: number;
  notas: string;
  eventoCodigo?: string | number | null;
  moneda?: string;
  cantidad?: number;
  descuento?: number;
  recargo?: number;
  horas?: number | null;
  personal?: number | null;
  fotosImpresas?: number | null;
  trailerMin?: number | null;
  filmMin?: number | null;
  precioOriginal?: number;
  editandoPrecio?: boolean;
  servicioNombre?: string;
}

interface PedidoServicioFecha {
  itemTmpId: string;
  fecha: string;
}

type AnyRecord = Record<string, unknown>;
interface UbicacionRow {
  ID: number;
  dbId?: number;
  Direccion: string;
  Fecha: string;
  Hora: string;
  DireccionExacta: string;
  Notas: string;
  hora12?: number | null;
  minuto?: string | null;
  ampm?: 'AM' | 'PM' | null;
}
type UbicacionRowEditable = UbicacionRow & { _backup?: UbicacionRow; editing?: boolean; _fechaPrev?: string };

@Component({
  selector: 'app-actualizar-pedido',
  templateUrl: './actualizar-pedido.component.html',
  styleUrls: ['./actualizar-pedido.component.css']
})
export class ActualizarPedidoComponent implements OnInit, AfterViewInit {
  private readonly igvRate = 0.18;
  saving = false;
  private initialSnapshot = '';
  private initialSnapshotData: PedidoSnapshot | null = null;
  private puedeCargarPaquetes = false;
  private viaticosChangeLock = false;
  private lastViaticosCliente: boolean | null = null;
  private lastViaticosMonto: number | null = null;
  readonly fechaMinimaEvento = ActualizarPedidoComponent.computeFechaMinimaEvento();
  readonly fechaMaximaEvento = ActualizarPedidoComponent.computeFechaMaximaEvento();
  readonly horaOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly minutoOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
  readonly ampmOptions = ['AM', 'PM'] as const;
  // ====== Columnas ======
  columnsToDisplay = ['Nro', 'Fecha', 'Hora', 'Direccion', 'DireccionExacta', 'Notas', 'Editar', 'Quitar'];
  paquetesColumns: TableColumn<PaqueteRow>[] = [
    { key: 'titulo', header: 'Título', sortable: true, width: '45%' },
    { key: 'precio', header: 'Precio', sortable: true, class: 'text-center', width: '120px' },
    { key: 'horas', header: 'Horas', sortable: true, class: 'text-center', width: '100px' },
    { key: 'staff', header: 'Staff', sortable: true, class: 'text-center', width: '100px' },
    { key: 'acciones', header: 'Seleccionar', sortable: false, filterable: false, class: 'text-center', width: '200px' }
  ];

  // ====== Data y catálogos ======
  servicios: AnyRecord[] = [];
  evento: AnyRecord[] = [];
  servicioSeleccionado = 1;
  eventoSeleccionado = 1;
  eventoSelectTouched = false;

  dataSource: MatTableDataSource<UbicacionRow> = new MatTableDataSource<UbicacionRow>([]);
  paquetesRows: PaqueteRow[] = [];
  loadingPaquetes = false;
  detallePaqueteAbierto = false;
  detallePaqueteSeleccionado: PaqueteDetalle | null = null;

  @ViewChild('sortUbic') sortUbic!: MatSort;

  private bindSorts() {
    if (this.sortUbic) this.dataSource.sort = this.sortUbic;
  }

  // ====== Estado general ======
  CodigoEmpleado = 1;
  infoCliente = { nombre: '', apellido: '', celular: '', correo: '', documento: '', direccion: '', razonSocial: '', idCliente: 0, idUsuario: 0 };
  dniCliente = '';
  clienteNombreCompleto = '';
  clienteCelular = '';
  clienteDocumento = '';

  // ====== Evento actual (inputs) ======
  Direccion = '';
  DireccionExacta = '';
  NotasEvento = '';

  // ====== Fechas ======
  fechaCreate = new Date();

  // ====== Ubicaciones ======
  ubicacion: UbicacionRow[] = [{ ID: 0, dbId: 0, Direccion: '', Fecha: '', Hora: '', DireccionExacta: '', Notas: '' }];

  // ====== Paquetes seleccionados ======
  selectedPaquetes: PedidoPaqueteSeleccionado[] = [];
  currentEventoKey: string | number | null = null;
  selectedPaquetesColumns: TableColumn<PedidoPaqueteSeleccionado>[] = [];
  asignacionFechasAbierta = false;
  fechasDisponibles: string[] = [];
  serviciosFechasSeleccionadas: PedidoServicioFecha[] = [];
  private tmpIdSequence = 0;
  private lastDepartamento = '';
  private departamentoChangeLock = false;

  readonly departamentos: string[] = [
    'Amazonas',
    'Ancash',
    'Apurimac',
    'Arequipa',
    'Ayacucho',
    'Cajamarca',
    'Callao',
    'Cusco',
    'Huancavelica',
    'Huanuco',
    'Ica',
    'Junin',
    'La Libertad',
    'Lambayeque',
    'Lima',
    'Loreto',
    'Madre de Dios',
    'Moquegua',
    'Pasco',
    'Piura',
    'Puno',
    'San Martin',
    'Tacna',
    'Tumbes',
    'Ucayali'
  ];

  // ====== Pedido actual ======
  private pedidoId!: number;
  private estadoPedidoId: number | null = null;
  private estadoPagoId: number | null = null;
  private cotizacionId: number | null = null;
  readonly programacionMinimaRecomendada = 1;

  public readonly pedidoService = inject(PedidoService);
  public readonly visualizarService = inject(VisualizarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ====== Ciclo de vida ======
  ngOnInit(): void {
    this.pedidoId = +(this.route.snapshot.paramMap.get('id') || 0);
    if (!this.pedidoId) {
      Swal.fire({
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
    this.refreshSelectedPaquetesColumns();

    // Inicializa cabecera
    // this.visualizarService.selectAgregarPedido = this.visualizarService.selectAgregarPedido ?? {};
    this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(this.fechaCreate, '');
    this.fechaValidate(this.fechaCreate);

    // Cargar el pedido existente
    this.loadPedido(this.pedidoId);
    this.lastDepartamento = (this.visualizarService.selectAgregarPedido.departamento ?? '').toString().trim();
  }

  ngAfterViewInit(): void {
    this.bindSorts();
  }

  private norm(s: string): string {
    return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private asRecord(value: unknown): AnyRecord {
    return value && typeof value === 'object' ? (value as AnyRecord) : {};
  }

  private getPkgKey(el: unknown): string {
    const record = this.asRecord(el);
    const eventoServicio = this.asRecord(record['eventoServicio']);
    const rawId = record['idEventoServicio'] ?? eventoServicio['id'] ?? record['id'];
    if (typeof rawId === 'number' || typeof rawId === 'string') {
      return String(rawId);
    }
    return '';
  }
  public pkgKey = (el: AnyRecord) => this.getPkgKey(el);


  // ====== Fechas ======
  fechaValidate(date: Date | string) {
    this.toIsoDate(date);
  }

  convert(strOrDate: string | Date) {
    const parsed = parseDateInput(strOrDate) ?? new Date();
    const mnth = ('0' + (parsed.getMonth() + 1)).slice(-2);
    const day = ('0' + parsed.getDate()).slice(-2);
    return [parsed.getFullYear(), mnth, day].join('-');
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

  rowInvalid(row: UbicacionRow): boolean {
    const fechaOk = !!row.Fecha;
    const horaOk = !!row.Hora;
    const dex = (row.DireccionExacta || '').trim();
    const direccionOk = !!(row.Direccion && row.Direccion.trim());
    const dexOk = dex.length >= 8;
    return !(fechaOk && horaOk && direccionOk && dexOk);
  }

  // ====== Cliente ======
  getDataCliente(dni: number) {
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
      if (!Array.isArray(res) || !res.length) return;
      this.infoCliente = res[0] as typeof this.infoCliente;
      const razonSocial = String(this.infoCliente.razonSocial ?? '').trim();
      const nombres = String(this.infoCliente.nombre ?? '').trim();
      const apellidos = String(this.infoCliente.apellido ?? '').trim();
      this.clienteNombreCompleto = razonSocial || [nombres, apellidos].filter(Boolean).join(' ').trim();
      this.clienteCelular = String(this.infoCliente.celular ?? '').trim();
      this.clienteDocumento = String(this.infoCliente.documento ?? '').trim();
    });
  }

  buscarCliente(dni: number) {
    this.getDataCliente(dni);
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

  asignarServicio(event: string | number) {
    const parsed = this.parseNumber(event);
    this.servicioSeleccionado = parsed ?? this.servicioSeleccionado;
    if (this.puedeCargarPaquetes) {
      this.getEventoxServicio();
    }
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

  asignarEvento(event: string | number, target?: HTMLSelectElement | null, prevValue?: string) {
    const parsed = this.parseNumber(event);
    if (parsed == null) {
      return;
    }
    if (this.selectedPaquetes.length && parsed !== this.eventoSeleccionado) {
      void Swal.fire({
        icon: 'warning',
        title: 'Cambiar tipo de evento',
        text: 'Cambiar el tipo de evento eliminará toda la selección de paquetes.',
        confirmButtonText: 'Cambiar',
        cancelButtonText: 'Cancelar',
        showCancelButton: true,
        reverseButtons: true
      }).then(result => {
        if (!result.isConfirmed) {
          if (target) {
            target.value = prevValue ?? '';
          }
          return;
        }
        this.selectedPaquetes = [];
        this.serviciosFechasSeleccionadas = [];
        this.asignacionFechasAbierta = false;
        this.fechasDisponibles = [];
        this.tmpIdSequence = 0;
        this.refreshSelectedPaquetesColumns();
        this.eventoSeleccionado = parsed;
        if (this.puedeCargarPaquetes) {
          this.getEventoxServicio();
        }
      });
      return;
    }
    this.eventoSeleccionado = parsed;
    if (this.puedeCargarPaquetes) {
      this.getEventoxServicio();
    }
  }

  onEventoDropdownChange(event: Event): void {
    this.eventoSelectTouched = true;
    const target = event.target as HTMLSelectElement | null;
    const rawValue = target?.value ?? '';
    const prevValue = (this.eventoSeleccionado ?? '').toString();
    this.asignarEvento(rawValue, target, prevValue);
  }

  getEventoxServicio() {
    const obs = this.visualizarService?.getEventosServicio?.(this.eventoSeleccionado, this.servicioSeleccionado);
    if (!obs || typeof obs.subscribe !== 'function') {
      console.warn('[getEventosServicio] devolvió undefined o no-Observable');
      this.paquetesRows = [];
      this.loadingPaquetes = false;
      return;
    }
    this.loadingPaquetes = true;
    obs.pipe(
      catchError((err: unknown) => {
        console.error('[getEventosServicio] error dentro del stream', err);
        this.loadingPaquetes = false;
        return of([]); // fallback
      })
    ).subscribe((res: unknown) => {
      const activos = Array.isArray(res)
        ? res.filter(item => {
          const record = item as Record<string, unknown>;
          const estado = record['estado'] as Record<string, unknown> | undefined;
          const estadoNombre = String(estado?.['nombre'] ?? '').toLowerCase();
          const estadoId = typeof estado?.['id'] === 'number' ? estado['id'] : null;
          return estadoNombre !== 'inactivo' && estadoId !== 2;
        })
        : [];
      this.paquetesRows = activos.map(item => this.normalizePaqueteRow(item as AnyRecord));
      this.loadingPaquetes = false;
    });
  }

  // ====== Selección de paquetes ======
  isInSeleccion(el: AnyRecord, eventoKey: string | number | null = this.currentEventoKey): boolean {
    const key = this.getPkgKey(el);
    const ek = eventoKey ?? null;
    return this.selectedPaquetes.some(p => p.key === key && (p.eventKey ?? null) === ek);
  }

  hasOtroPaqueteDelServicio(element: AnyRecord): boolean {
    const record = this.asRecord(element);
    const servicio = record['servicio'] as Record<string, unknown> | undefined;
    const servicioId = typeof servicio?.['id'] === 'number' ? servicio['id'] : null;
    if (servicioId == null) {
      return false;
    }
    const key = this.getPkgKey(element);
    return this.selectedPaquetes.some(p => (p.servicioId ?? null) === servicioId && p.key !== key);
  }

  shouldShowPrecioOriginal(): boolean {
    return this.selectedPaquetes.some(item => this.isPrecioModificado(item));
  }

  isPrecioModificado(paquete: PedidoPaqueteSeleccionado): boolean {
    const actual = Number(paquete.precio ?? 0);
    const original = Number(paquete.precioOriginal ?? actual);
    if (!Number.isFinite(actual) || !Number.isFinite(original)) {
      return false;
    }
    return Math.abs(actual - original) > 0.009;
  }

  getDescuentoPorcentaje(paquete: PedidoPaqueteSeleccionado): number | null {
    const original = Number(paquete.precioOriginal ?? 0);
    const actual = Number(paquete.precio ?? 0);
    if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(actual)) {
      return null;
    }
    if (actual >= original) {
      return null;
    }
    const diff = ((original - actual) / original) * 100;
    return Number(diff.toFixed(1));
  }

  enablePrecioEdit(paquete: PedidoPaqueteSeleccionado): void {
    const key = paquete.key;
    this.selectedPaquetes = this.selectedPaquetes.map(item =>
      item.key === key ? { ...item, editandoPrecio: true } : item
    );
    this.focusPrecioInput(key);
  }

  confirmPrecioEdit(paquete: PedidoPaqueteSeleccionado, rawValue: string | number | null | undefined): void {
    const key = paquete.key;
    const current = this.selectedPaquetes.find(item => item.key === key);
    if (!current) {
      return;
    }

    let value = Number(rawValue);
    if (!Number.isFinite(value) || value <= 0) {
      value = current.precio;
    }

    const minimo = this.getPrecioMinimo(current);
    if (value < minimo) {
      value = minimo;
      this.showAlert('info', 'Ajuste no permitido', 'Solo puedes reducir el precio hasta un 5% respecto al valor base.');
    }

    this.selectedPaquetes = this.selectedPaquetes.map(item =>
      item.key === key
        ? { ...item, precio: value, editandoPrecio: false }
        : item
    );
    this.refreshSelectedPaquetesColumns();
  }

  cancelPrecioEdit(paquete: PedidoPaqueteSeleccionado): void {
    const key = paquete.key;
    this.selectedPaquetes = this.selectedPaquetes.map(item =>
      item.key === key ? { ...item, editandoPrecio: false } : item
    );
  }

  onCantidadChange(paquete: PedidoPaqueteSeleccionado, value: unknown): void {
    const parsed = this.parseNumber(value);
    const base = parsed != null && parsed >= 1 ? Math.floor(parsed) : 1;
    const max = this.getCantidadMaximaPorDias();
    paquete.cantidad = max != null ? Math.min(base, max) : base;
    if (paquete.tmpId) {
      let count = 0;
      this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry => {
        if (entry.itemTmpId !== paquete.tmpId) {
          return true;
        }
        if (count < (paquete.cantidad || 1)) {
          count += 1;
          return true;
        }
        return false;
      });
    }
  }

  getPrecioInputId(paquete: PedidoPaqueteSeleccionado): string {
    return this.getPrecioInputIdFromKey(paquete.key);
  }

  getPrecioMinimo(paquete: PedidoPaqueteSeleccionado): number {
    const base = Number(paquete.precioOriginal ?? paquete.precio ?? 0);
    if (!Number.isFinite(base) || base <= 0) {
      return 0;
    }
    return Number((base * 0.95).toFixed(2));
  }

  addPaquete(el: AnyRecord, eventoKey: string | number | null = this.currentEventoKey) {
    if (this.isInSeleccion(el, eventoKey)) {
      // ...
      return;
    }
    const record = el as Record<string, unknown>;
    const idEventoServicio = typeof record['id'] === 'number' ? record['id'] : null;
    const eventoRecord = record['evento'] as Record<string, unknown> | undefined;
    const servicioRecord = record['servicio'] as Record<string, unknown> | undefined;
    const eventoId = typeof eventoRecord?.['id'] === 'number' ? eventoRecord['id'] : null;
    const servicioId = typeof servicioRecord?.['id'] === 'number' ? servicioRecord['id'] : null;
    const nombre = String(record['titulo'] ?? '');
    const descripcion = String(record['descripcion'] ?? '');
    const moneda = String(record['moneda'] ?? 'USD');
    const precioUnit = Number(record['precio'] ?? 0);
    const cantidad = 1;
    const descuento = 0;
    const recargo = 0;
    const notas = '';
    const horas = record['horas'] != null ? Number(record['horas']) : null;
    const staffRecord = record['staff'] as Record<string, unknown> | undefined;
    const personal = staffRecord?.['total'] != null ? Number(staffRecord['total']) : null;
    const fotosImpresas = record['fotosImpresas'] != null ? Number(record['fotosImpresas']) : null;
    const trailerMin = record['trailerMin'] != null ? Number(record['trailerMin']) : null;
    const filmMin = record['filmMin'] != null ? Number(record['filmMin']) : null;
    this.tmpIdSequence += 1;
    const tmpId = `i${this.tmpIdSequence}`;
    const restantes = this.selectedPaquetes.filter(item => (item.servicioId ?? null) !== servicioId);
    this.selectedPaquetes = [
      ...restantes,
      {
        key: this.getPkgKey(el),
        eventKey: eventoKey ?? null,
        tmpId,
        idEventoServicio,
        eventoId,
        servicioId,
        servicioNombre: typeof servicioRecord?.['nombre'] === 'string' ? servicioRecord['nombre'] : undefined,
        nombre,
        titulo: nombre,
        descripcion,
        precioUnit,
        precio: precioUnit,
        moneda,
        cantidad,
        descuento,
        recargo,
        notas,
        horas,
        personal,
        fotosImpresas,
        trailerMin,
        filmMin,
        precioOriginal: precioUnit,
        editandoPrecio: false
      }
    ];
    if (this.serviciosFechasSeleccionadas.length) {
      const tmpIds = new Set(this.selectedPaquetes.map(item => item.tmpId));
      this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry => tmpIds.has(entry.itemTmpId));
    }
    this.refreshSelectedPaquetesColumns();
  }
  removePaquete(key: string | number | null, eventoKey: string | number | null = this.currentEventoKey) {
    const removed = this.selectedPaquetes.find(p => p.key === key && p.eventKey === eventoKey);
    this.selectedPaquetes = this.selectedPaquetes.filter(p => !(p.key === key && p.eventKey === eventoKey));
    if (removed?.tmpId) {
      this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry => entry.itemTmpId !== removed.tmpId);
    }
    this.refreshSelectedPaquetesColumns();
  }

  mostrarDetallePaquete(row: PaqueteRow): void {
    this.detallePaqueteSeleccionado = (row?.raw as PaqueteDetalle) ?? null;
    this.detallePaqueteAbierto = !!this.detallePaqueteSeleccionado;
  }

  cerrarDetallePaquete(): void {
    this.detallePaqueteAbierto = false;
    this.detallePaqueteSeleccionado = null;
  }

  getDetalleStaffLista(paquete: unknown): AnyRecord[] {
    const record = this.asRecord(paquete);
    const staff = this.asRecord(record['staff']);
    const lista = staff['detalle'] ?? record['staff'] ?? [];
    return Array.isArray(lista) ? lista : [];
  }

  getEquiposLista(paquete: unknown): AnyRecord[] {
    const record = this.asRecord(paquete);
    const lista = record['equipos'] ?? [];
    return Array.isArray(lista) ? lista : [];
  }

  getDetalleStaffTotal(paquete: PaqueteDetalle | null | undefined): string | number {
    if (!paquete) {
      return '—';
    }
    const staff = paquete.staff;
    if (typeof staff === 'number') {
      return staff;
    }
    const total = staff?.total ?? paquete.personal;
    return total ?? '—';
  }

  get totalSeleccion(): number {
    const subtotal = this.selectedPaquetes.reduce((sum, p) => {
      const precio = Number(p.precio) || 0;
      const cantidad = Number(p.cantidad ?? 1) || 1;
      return sum + (precio * cantidad);
    }, 0);
    return subtotal + this.getViaticosMontoTotal();
  }

  get totalPaquetes(): number {
    return this.selectedPaquetes.reduce((sum, p) => {
      const precio = Number(p.precio) || 0;
      const cantidad = Number(p.cantidad ?? 1) || 1;
      return sum + (precio * cantidad);
    }, 0);
  }

  get subtotalSinIgv(): number {
    return this.totalSeleccion;
  }

  get igvMonto(): number {
    const base = this.subtotalSinIgv;
    return Number((base * this.igvRate).toFixed(2));
  }

  get totalConIgv(): number {
    return Number((this.subtotalSinIgv + this.igvMonto).toFixed(2));
  }

  private getViaticosMontoTotal(): number {
    const departamento = (this.visualizarService.selectAgregarPedido?.departamento ?? '').toString().trim().toLowerCase();
    if (departamento === 'lima') {
      return 0;
    }
    const viaticosCliente = Boolean(this.visualizarService.selectAgregarPedido?.viaticosCliente);
    if (viaticosCliente) {
      return 0;
    }
    const monto = this.parseNumber(this.visualizarService.selectAgregarPedido?.viaticosMonto);
    return monto != null && monto > 0 ? monto : 0;
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
    const parsed = this.parseNumber(raw);
    return parsed != null && parsed >= 1 ? parsed : null;
  }

  getCantidadMaximaPorDias(): number | null {
    const parsed = this.getDiasTrabajo();
    return parsed != null && parsed >= 1 ? parsed : null;
  }

  private getFechasUbicacionUnicas(): string[] {
    const fechas = this.ubicacion
      .map(item => (item.Fecha ?? '').toString().trim())
      .filter(Boolean);
    return Array.from(new Set(fechas)).sort();
  }

  formatFechaConDia(fecha: string): string {
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

  abrirAsignacionFechas(): void {
    if (!this.isMultipleDias()) {
      return;
    }
    const fechasUnicas = this.getFechasUbicacionUnicas();
    this.fechasDisponibles = fechasUnicas.length ? fechasUnicas : [];
    if (!this.fechasDisponibles.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Fechas pendientes',
        text: 'Registra fechas en la programación para asignarlas a los servicios.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    const tmpIds = new Set(this.selectedPaquetes.map(item => item.tmpId));
    this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry =>
      tmpIds.has(entry.itemTmpId) && this.fechasDisponibles.includes(entry.fecha)
    );
    this.asignacionFechasAbierta = true;
  }

  cerrarAsignacionFechas(): void {
    this.asignacionFechasAbierta = false;
  }

  isFechaAsignada(itemTmpId: string, fecha: string): boolean {
    return this.serviciosFechasSeleccionadas.some(entry => entry.itemTmpId === itemTmpId && entry.fecha === fecha);
  }

  toggleFechaAsignada(itemTmpId: string, fecha: string, checked: boolean, maxCantidad: number): void {
    if (checked) {
      const count = this.serviciosFechasSeleccionadas.filter(entry => entry.itemTmpId === itemTmpId).length;
      if (count >= maxCantidad) {
        Swal.fire({
          icon: 'info',
          title: 'Cantidad completa',
          text: 'Ya asignaste todas las fechas requeridas para este servicio.',
          confirmButtonText: 'Entendido'
        });
        return;
      }
      this.serviciosFechasSeleccionadas = [
        ...this.serviciosFechasSeleccionadas,
        { itemTmpId, fecha }
      ];
      return;
    }
    this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry =>
      !(entry.itemTmpId === itemTmpId && entry.fecha === fecha)
    );
  }

  getCantidadAsignada(itemTmpId: string): number {
    return this.serviciosFechasSeleccionadas.filter(entry => entry.itemTmpId === itemTmpId).length;
  }

  private getTotalCantidadSeleccionada(): number {
    return this.selectedPaquetes.reduce((acc, item) => {
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + cantidad;
    }, 0);
  }

  isMultipleDias(): boolean {
    const parsed = this.getDiasTrabajo();
    return parsed != null && parsed > 1;
  }

  shouldShowFechaEvento(): boolean {
    const parsed = this.getDiasTrabajo();
    return parsed != null && parsed <= 1;
  }

  isDepartamentoLima(): boolean {
    const depto = (this.visualizarService.selectAgregarPedido.departamento ?? '').toString().trim().toLowerCase();
    return depto === 'lima';
  }

  onDepartamentoChange(value: unknown): void {
    if (this.departamentoChangeLock) {
      return;
    }
    const next = (value ?? '').toString().trim();
    const prev = (this.lastDepartamento ?? '').toString().trim();
    if (!prev) {
      this.visualizarService.selectAgregarPedido.departamento = next;
      this.lastDepartamento = next;
      this.applyViaticosRules();
      return;
    }
    if (!next || next === prev) {
      this.visualizarService.selectAgregarPedido.departamento = next;
      this.lastDepartamento = next;
      this.applyViaticosRules();
      return;
    }
    const monto = this.parseNumber(this.visualizarService.selectAgregarPedido?.viaticosMonto);
    const avisoMonto = monto != null && monto > 0
      ? 'El monto de viaticos podria variar si cambias de departamento.'
      : '';
    const texto = avisoMonto
      ? `¿Seguro que deseas cambiar el departamento de "${prev}" a "${next}"? ${avisoMonto}`
      : `¿Seguro que deseas cambiar el departamento de "${prev}" a "${next}"?`;
    void Swal.fire({
      icon: 'warning',
      title: 'Cambiar departamento',
      text: texto,
      showCancelButton: true,
      confirmButtonText: 'Cambiar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.visualizarService.selectAgregarPedido.departamento = next;
        this.lastDepartamento = next;
        this.applyViaticosRules();
        this.syncViaticosSnapshot();
        return;
      }
      this.departamentoChangeLock = true;
      this.visualizarService.selectAgregarPedido.departamento = prev;
      this.departamentoChangeLock = false;
    });
  }

  onViaticosClienteChange(value: unknown): void {
    if (this.viaticosChangeLock) {
      return;
    }
    const prev = this.lastViaticosCliente ?? Boolean(this.visualizarService.selectAgregarPedido.viaticosCliente);
    const next = Boolean(value);
    if (prev === next) {
      return;
    }
    const beforeText = prev ? 'Cliente cubre viaticos' : 'Cliente NO cubre viaticos';
    const afterText = next ? 'Cliente cubre viaticos' : 'Cliente NO cubre viaticos';
    void Swal.fire({
      icon: 'warning',
      title: 'Confirmar cambio de viaticos',
      text: `Actual: ${beforeText}. Nuevo: ${afterText}.`,
      showCancelButton: true,
      confirmButtonText: 'Aceptar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.visualizarService.selectAgregarPedido.viaticosCliente = next;
        this.applyViaticosRules();
        this.syncViaticosSnapshot();
        return;
      }
      this.viaticosChangeLock = true;
      this.visualizarService.selectAgregarPedido.viaticosCliente = prev;
      this.applyViaticosRules();
      this.visualizarService.selectAgregarPedido.viaticosMonto = this.lastViaticosMonto ?? null;
      this.viaticosChangeLock = false;
    });
  }

  private applyViaticosRules(): void {
    if (this.isDepartamentoLima()) {
      this.visualizarService.selectAgregarPedido.viaticosCliente = true;
      this.visualizarService.selectAgregarPedido.viaticosMonto = null;
      return;
    }
    if (this.visualizarService.selectAgregarPedido.viaticosCliente) {
      this.visualizarService.selectAgregarPedido.viaticosMonto = null;
    }
  }

  onViaticosMontoBlur(value: unknown): void {
    if (this.viaticosChangeLock || this.visualizarService.selectAgregarPedido.viaticosCliente) {
      return;
    }
    const parsed = this.parseNumber(value);
    const next = parsed != null && parsed > 0 ? parsed : null;
    const prev = this.lastViaticosMonto ?? null;
    if (prev === next) {
      return;
    }
    void Swal.fire({
      icon: 'warning',
      title: 'Confirmar cambio de viaticos',
      text: `Actual: ${prev ?? 'sin monto'}. Nuevo: ${next ?? 'sin monto'}.`,
      showCancelButton: true,
      confirmButtonText: 'Aceptar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.visualizarService.selectAgregarPedido.viaticosMonto = next;
        this.syncViaticosSnapshot();
        return;
      }
      this.viaticosChangeLock = true;
      this.visualizarService.selectAgregarPedido.viaticosMonto = prev;
      this.viaticosChangeLock = false;
    });
  }

  private syncViaticosSnapshot(): void {
    const lugar = (this.visualizarService.selectAgregarPedido?.departamento ?? '').toString().trim();
    const lugarLower = lugar.toLowerCase();
    const viaticosCliente = lugarLower === 'lima'
      ? true
      : Boolean(this.visualizarService.selectAgregarPedido?.viaticosCliente);
    const viaticosMonto = viaticosCliente
      ? null
      : (this.parseNumber(this.visualizarService.selectAgregarPedido?.viaticosMonto) ?? null);
    this.lastViaticosCliente = viaticosCliente;
    this.lastViaticosMonto = viaticosMonto;
  }

  onDiasChange(value: unknown): void {
    const parsed = this.parseNumber(value);
    this.visualizarService.selectAgregarPedido.dias = parsed != null ? Math.max(1, Math.floor(parsed)) : null;
    const multiple = this.isMultipleDias();
    const max = this.getCantidadMaximaPorDias();
    if (!multiple) {
      this.selectedPaquetes = this.selectedPaquetes.map(item => ({ ...item, cantidad: 1 }));
    } else if (max != null) {
      const ajustados = this.selectedPaquetes.map(item => ({
        ...item,
        cantidad: Math.min(Number(item.cantidad ?? 1) || 1, max)
      }));
      const changed = ajustados.some((item, index) => item.cantidad !== this.selectedPaquetes[index]?.cantidad);
      if (changed) {
        this.selectedPaquetes = ajustados;
        this.serviciosFechasSeleccionadas = [];
      }
    }
    if (multiple) {
      this.visualizarService.selectAgregarPedido.fechaEvent = '';
    } else {
      this.serviciosFechasSeleccionadas = [];
      if (this.asignacionFechasAbierta) {
        this.asignacionFechasAbierta = false;
      }
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
      const fechaAnterior = (row._fechaPrev ?? '').toString().trim();
      if (fechaAnterior && fechaAnterior !== fecha) {
        const sigueUsada = this.ubicacion.some(item => item.Fecha === fechaAnterior);
        if (!sigueUsada && this.visualizarService.selectAgregarPedido.fechaEvent === fechaAnterior) {
          this.visualizarService.selectAgregarPedido.fechaEvent = fecha;
        }
        if (!sigueUsada && this.serviciosFechasSeleccionadas.length) {
          this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.map(entry =>
            entry.fecha === fechaAnterior ? { ...entry, fecha } : entry
          );
        }
      }
      row._fechaPrev = row.Fecha;
      return;
    }
    const fechaAnterior = (row._fechaPrev ?? '').toString().trim();
    const fechasPermitidas = fechasUnicas.filter(item => item !== fecha);
    const fechasTexto = fechasPermitidas.slice(0, maxDias);
    if (!fechaAnterior) {
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
      return;
    }
    Swal.fire({
      icon: 'warning',
      title: 'Cambiar fechas',
      html: `
        <p>Ya seleccionaste ${maxDias} día(s):</p>
        <ul class="text-start mb-3">
          ${fechasTexto.map(item => `<li>${this.formatFechaConDia(item)}</li>`).join('')}
        </ul>
        <p class="mb-0">¿Quieres cambiar todas las locaciones del día <b>${this.formatFechaConDia(fechaAnterior)}</b> al día <b>${this.formatFechaConDia(fecha)}</b>?</p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar todas',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) {
        row.Fecha = row._fechaPrev ?? '';
        return;
      }
      this.ubicacion.forEach(item => {
        if (item.Fecha === fechaAnterior) {
          item.Fecha = fecha;
          const editable = item as UbicacionRowEditable;
          if (editable._backup?.Fecha === fechaAnterior) {
            editable._backup.Fecha = fecha;
          }
          editable._fechaPrev = fecha;
        }
      });
      if (this.visualizarService.selectAgregarPedido.fechaEvent === fechaAnterior) {
        this.visualizarService.selectAgregarPedido.fechaEvent = fecha;
      }
      if (this.serviciosFechasSeleccionadas.length) {
        this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.map(entry =>
          entry.fecha === fechaAnterior ? { ...entry, fecha } : entry
        );
      }
    });
  }

  get canAgregarEvento(): boolean {
    return true;
  }

  onQuickAdd() {
    const fecha = this.shouldShowFechaEvento() ? (this.visualizarService.selectAgregarPedido.fechaEvent || '') : '';
    const hora = this.visualizarService.selectAgregarPedido.horaEvent || '';
    const nextId = this.ubicacion.length ? Math.max(...this.ubicacion.map(u => u.ID)) + 1 : 1;
    const parts = this.splitHoraParts(hora);
    this.ubicacion = [
      ...this.ubicacion,
      {
        ID: nextId,
        dbId: 0,
        Direccion: '',
        Fecha: fecha,
        Hora: hora,
        DireccionExacta: '',
        Notas: '',
        hora12: parts.hora12,
        minuto: parts.minuto,
        ampm: parts.ampm
      }
    ];
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }

  addListUbicacion(direccion: string, fecha: string, hora: string, direccionExacta?: string, notas?: string) {
    const yaExiste = this.ubicacion.some(u =>
      u.Fecha === fecha &&
      u.Hora === hora &&
      this.norm(u.Direccion) === this.norm(direccion || '')
    );
    if (yaExiste) {
      Swal.fire({
        icon: 'warning',
        title: 'Evento duplicado',
        text: 'Ya existe un evento con la misma fecha, hora y ubicación.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const cualEliminar = { ID: 0, Direccion: '' };
    this.ubicacion = this.ubicacion.filter((item) => {
      return item.ID != cualEliminar.ID && item.Direccion != cualEliminar.Direccion;
    });

    const i = this.ubicacion.length ? Math.max(...this.ubicacion.map(u => u.ID)) + 1 : 1;
    const parts = this.splitHoraParts(hora);
    this.ubicacion.push({
      ID: i,
      dbId: 0,
      Direccion: direccion,
      Fecha: fecha,
      Hora: hora,
      DireccionExacta: direccionExacta ?? '',
      Notas: notas ?? '',
      hora12: parts.hora12,
      minuto: parts.minuto,
      ampm: parts.ampm
    });
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }


  async deleteElement(p: string, c: string) {
    const fila = this.ubicacion.find(x => x.Hora == c && x.Direccion == p);
    const nombre = (fila?.Direccion ?? '').toString().trim() || 'Locación';
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar locación',
      text: `¿Quieres eliminar "${nombre}" de la programación?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    });

    if (!isConfirmed) return;

    const idx = this.ubicacion.findIndex(x => x.Hora == c && x.Direccion == p);
    if (idx >= 0) {
      this.ubicacion.splice(idx, 1);
      this.dataSource.data = this.ubicacion;
      this.bindSorts();
      this.showToast('success', 'Locación eliminada', 'Se eliminó la locación seleccionada.');
    }
  }

  drop(event: CdkDragDrop<AnyRecord[]>) {
    moveItemInArray(this.ubicacion, event.previousIndex, event.currentIndex);
    this.ubicacion = [...this.ubicacion];
    this.dataSource.data = this.ubicacion;
    this.bindSorts();
  }

  // ====== Carga del pedido existente ======
  private loadPedido(id: number) {
    const obs = this.visualizarService.getPedidoById?.(id) as Observable<PedidoResponse> | undefined;
    if (!obs || typeof obs.subscribe !== 'function') {
      console.error('[getPedidoById] no disponible');
      return;
    }

    obs.pipe(
      catchError((err: unknown) => {
        console.error('[getPedidoById] error', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar',
          text: 'No se pudo cargar el pedido.',
          confirmButtonText: 'Entendido'
        });
        return of(null);
      })
    ).subscribe((data: PedidoResponse | null) => {
      if (!data) return;

      const { pedido, eventos, items, serviciosFechas } = data;

      // === Mapear cabecera ===
      this.visualizarService.selectAgregarPedido.NombrePedido = pedido.nombrePedido ?? '';
      this.visualizarService.selectAgregarPedido.Observacion = pedido.observaciones ?? '';
      this.visualizarService.selectAgregarPedido.mensaje = pedido.mensaje ?? '';
      this.visualizarService.selectAgregarPedido.departamento = pedido.lugar ?? 'Lima';
      this.lastDepartamento = this.visualizarService.selectAgregarPedido.departamento.toString().trim();
      const viaticosClienteApi = typeof pedido.viaticosCliente === 'boolean'
        ? pedido.viaticosCliente
        : !(pedido.viaticosMonto && pedido.viaticosMonto > 0);
      this.visualizarService.selectAgregarPedido.viaticosCliente = viaticosClienteApi;
      this.visualizarService.selectAgregarPedido.viaticosMonto = pedido.viaticosMonto ?? null;
      this.CodigoEmpleado = pedido.empleadoId ?? this.CodigoEmpleado;
      this.estadoPedidoId = pedido.estadoPedidoId ?? null;
      this.estadoPagoId = pedido.estadoPagoId ?? null;
      if (pedido.idTipoEvento != null) {
        this.eventoSeleccionado = pedido.idTipoEvento;
      }
      if (pedido.cotizacionId != null) {
        this.cotizacionId = pedido.cotizacionId;
      } else {
        this.cotizacionId = null;
      }
      const fechaCreacionParsed = parseDateInput(pedido.fechaCreacion) ?? new Date();
      this.fechaCreate = fechaCreacionParsed;
      this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(fechaCreacionParsed, '');

      // Fecha base del evento (cabecera)
      if (pedido.fechaEvento) {
        const iso = this.toIsoDate(pedido.fechaEvento);
        this.visualizarService.selectAgregarPedido.fechaEvent = iso;
        this.fechaValidate(iso);
      }
      this.applyViaticosRules();
      this.syncViaticosSnapshot();

      // Cliente
      this.infoCliente = {
        nombre: pedido.cliente.nombres ?? '',
        apellido: pedido.cliente.apellidos ?? '',
        celular: pedido.cliente.celular ?? '',
        correo: pedido.cliente.correo ?? '',
        documento: pedido.cliente.documento ?? '',
        direccion: pedido.cliente.direccion ?? '',
        razonSocial: pedido.cliente.razonSocial ?? '',
        idCliente: pedido.clienteId ?? 0,
        idUsuario: 0
      };
      const razonSocial = String(pedido.cliente.razonSocial ?? '').trim();
      const nombres = String(pedido.cliente.nombres ?? '').trim();
      const apellidos = String(pedido.cliente.apellidos ?? '').trim();
      this.clienteNombreCompleto = razonSocial || [nombres, apellidos].filter(Boolean).join(' ').trim();
      this.clienteCelular = String(pedido.cliente.celular ?? '').trim();
      this.clienteDocumento = String(pedido.cliente.documento ?? '').trim();
      this.dniCliente = this.infoCliente.documento || '';

      // === Mapear eventos ===
      this.ubicacion = eventos.map((record, idx) => {
        const horaValue = String(record.hora ?? '').slice(0, 5);
        const parts = this.splitHoraParts(horaValue);
        return {
          ID: idx + 1,                 // solo para la tabla
          dbId: Number(record.id ?? 0),
          Direccion: String(record.ubicacion ?? ''),
          Fecha: String(record.fecha ?? '').slice(0, 10),
          Hora: horaValue,
          DireccionExacta: String(record.direccion ?? ''),
          Notas: String(record.notas ?? ''),
          hora12: parts.hora12,
          minuto: parts.minuto,
          ampm: parts.ampm
        };
      });
      this.dataSource.data = this.ubicacion;
      this.bindSorts();

      const diasCab = pedido.dias ?? null;
      const fechasUnicas = new Set(
        eventos
          .map(ev => String(ev.fecha ?? '').slice(0, 10))
          .filter(Boolean)
      );
      const diasInferidos = fechasUnicas.size ? fechasUnicas.size : (pedido.fechaEvento ? 1 : null);
      this.visualizarService.selectAgregarPedido.dias = diasCab ?? diasInferidos ?? 1;
      this.onDiasChange(this.visualizarService.selectAgregarPedido.dias);
      this.visualizarService.selectAgregarPedido.horasEstimadas = pedido.horasEstimadas ?? null;

      // Precargar controles "Fecha/Hora" superiores con el primer evento (UX)
      const first = this.ubicacion[0];
      if (first) {
        if (this.shouldShowFechaEvento() && !this.visualizarService.selectAgregarPedido.fechaEvent) {
          this.visualizarService.selectAgregarPedido.fechaEvent = first.Fecha;
          this.fechaValidate(first.Fecha);
        }
        this.visualizarService.selectAgregarPedido.horaEvent = first.Hora;
      } else {
        if (this.visualizarService.selectAgregarPedido.fechaEvent) {
          this.fechaValidate(this.visualizarService.selectAgregarPedido.fechaEvent);
        } else {
          this.fechaValidate(this.fechaCreate);
        }
      }

      // === Mapear items/paquetes ===
      // this.selectedPaquetes = (Array.isArray(items) ? items : []).map((it: any) => ({
      //   key: this.getPkgKey(it),                         // ahora sí dará el mismo valor que en el catálogo
      //   eventKey: it.eventoCodigo ?? null,               // si asocias por evento
      //   ID: it.exsId ?? it.id ?? null,                   // importante: conserva el ID del paquete
      //   descripcion: it.nombre ?? it.descripcion ?? '',
      //   precio: Number(it.precioUnit ?? it.precio ?? 0), // normaliza precio
      //   notas: it.notas ?? ''
      // }));
      this.selectedPaquetes = items.map((record, index) => {
        const eventoCodigo = record.eventoCodigo ?? null;
        const idValue = record.id ?? undefined;
        const tmpId = idValue != null ? `i${idValue}` : `i${index + 1}`;
        return {
          id: idValue,
          key: this.getPkgKey(record as unknown as AnyRecord),
          eventKey: eventoCodigo,
          tmpId,
          eventoCodigo,
          idEventoServicio: record.idEventoServicio ?? null,
          eventoId: record.eventoId ?? null,
          servicioId: record.servicioId ?? null,
          nombre: record.nombre ?? '',
          titulo: record.nombre ?? '',
          descripcion: record.descripcion ?? '',
          precioUnit: record.precioUnit ?? 0,
          precio: record.precioUnit ?? 0,
          notas: record.notas ?? '',
          moneda: record.moneda ?? 'USD',
          cantidad: record.cantidad ?? 1,
          descuento: record.descuento ?? 0,
          recargo: record.recargo ?? 0,
          horas: record.horas ?? null,
          personal: record.personal ?? null,
          fotosImpresas: record.fotosImpresas ?? null,
          trailerMin: record.trailerMin ?? null,
          filmMin: record.filmMin ?? null,
          precioOriginal: record.precioUnit ?? 0,
          editandoPrecio: false
        };
      });
      this.tmpIdSequence = this.selectedPaquetes.reduce((acc, item) => {
        const match = /^i(\d+)$/.exec(item.tmpId);
        if (!match) {
          return acc;
        }
        const value = Number(match[1]);
        return Number.isFinite(value) && value > acc ? value : acc;
      }, 0);
      const servicioDesdeItems = this.selectedPaquetes.find(item => item.servicioId != null)?.servicioId ?? null;
      if (servicioDesdeItems != null) {
        this.servicioSeleccionado = servicioDesdeItems;
      }
      const eventoDesdeItems = this.selectedPaquetes.find(item => item.eventoId != null)?.eventoId ?? null;
      if (eventoDesdeItems != null) {
        this.eventoSeleccionado = eventoDesdeItems;
      }

      const tmpIdMap = new Map<number, string>();
      this.selectedPaquetes.forEach(item => {
        if (item.id != null) {
          tmpIdMap.set(item.id, item.tmpId);
        }
      });
      this.serviciosFechasSeleccionadas = serviciosFechas
        .map((entry) => {
          const fecha = String(entry.fecha ?? '').slice(0, 10);
          const itemTmpId = tmpIdMap.get(entry.idPedidoServicio) ?? `i${entry.idPedidoServicio}`;
          return { itemTmpId, fecha };
        })
        .filter(entry => entry.itemTmpId && entry.fecha);
      if (this.serviciosFechasSeleccionadas.length) {
        const tmpIds = new Set(this.selectedPaquetes.map(item => item.tmpId));
        this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry =>
          tmpIds.has(entry.itemTmpId)
        );
      }
      this.refreshSelectedPaquetesColumns();
      this.puedeCargarPaquetes = true;
      if (this.eventoSeleccionado != null && this.servicioSeleccionado != null) {
        this.getEventoxServicio();
      }
      this.initialSnapshotData = this.buildSnapshotData();
      this.initialSnapshot = JSON.stringify(this.initialSnapshotData);
    });
  }

  // ====== Enviar actualización ======


  updatePedido() {
    if (this.saving) return;              // ← evita doble click
    if (!this.pedidoId) return;
    const currentSnapshotData = this.buildSnapshotData();
    const currentSnapshot = JSON.stringify(currentSnapshotData);
    if (this.initialSnapshot && this.initialSnapshot === currentSnapshot) {
      this.router.navigate(['/home/gestionar-pedido']);
      return;
    }

    const diasTrabajo = this.getDiasTrabajo();
    if (diasTrabajo == null) {
      Swal.fire({
        icon: 'warning',
        title: 'Días requeridos',
        text: 'Selecciona la cantidad de días del evento.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    if (!this.isMultipleDias()) {
      const fechaError = this.getFechaEventoError();
      if (fechaError) {
        Swal.fire({
          icon: 'warning',
          title: 'Fecha inválida',
          text: 'Selecciona una fecha dentro del rango permitido.',
          confirmButtonText: 'Entendido'
        });
        return;
      }
    } else {
      const fechasUnicas = new Set(
        (this.ubicacion || [])
          .map(u => String(u.Fecha || '').trim())
          .filter(Boolean)
      );
      if (fechasUnicas.size < diasTrabajo) {
        Swal.fire({
          icon: 'warning',
          title: 'Fechas insuficientes',
          text: `Para ${diasTrabajo} días de trabajo debes registrar al menos ${diasTrabajo} fechas diferentes en las locaciones.`,
          confirmButtonText: 'Entendido'
        });
        return;
      }
      if (fechasUnicas.size > diasTrabajo) {
        Swal.fire({
          icon: 'warning',
          title: 'Fechas excedidas',
          text: `Tienes ${fechasUnicas.size} fechas diferentes. Reduce a ${diasTrabajo} fechas para continuar.`,
          confirmButtonText: 'Entendido'
        });
        return;
      }
    }

    if (!this.infoCliente?.idCliente) {
      Swal.fire({
        icon: 'warning',
        title: 'Cliente requerido',
        text: 'El pedido debe tener un cliente válido.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    if (!this.ubicacion?.length || !this.ubicacion.some(u => (u?.Direccion || '').trim())) {
      Swal.fire({
        icon: 'warning',
        title: 'Ubicación requerida',
        text: 'Agrega al menos una ubicación válida antes de actualizar.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    if (!this.selectedPaquetes?.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Paquetes requeridos',
        text: 'Selecciona al menos un paquete/ítem antes de actualizar.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    if (diasTrabajo > 2) {
      const totalCantidad = this.getTotalCantidadSeleccionada();
      if (totalCantidad < diasTrabajo) {
        Swal.fire({
          icon: 'warning',
          title: 'Cantidades insuficientes',
          text: `Para ${diasTrabajo} días debes asignar al menos ${diasTrabajo} servicios en total.`,
          confirmButtonText: 'Entendido'
        });
        return;
      }
    }

    const departamento = (this.visualizarService.selectAgregarPedido?.departamento ?? '').toString().trim();
    const viaticosCliente = Boolean(this.visualizarService.selectAgregarPedido?.viaticosCliente);
    const viaticosMonto = this.parseNumber(this.visualizarService.selectAgregarPedido?.viaticosMonto);
    if (departamento && departamento.toLowerCase() !== 'lima' && !viaticosCliente) {
      if (viaticosMonto == null || viaticosMonto <= 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Viáticos requeridos',
          text: 'Ingresa el monto de viáticos.',
          confirmButtonText: 'Entendido'
        });
        return;
      }
    }

    const fechasUnicas = Array.from(new Set(
      (this.ubicacion || [])
        .map(u => String(u.Fecha || '').trim())
        .filter(Boolean)
    )).sort();
    const fechaEventoForm = this.visualizarService.selectAgregarPedido?.fechaEvent;
    const fechasBase = fechasUnicas.length ? fechasUnicas : (fechaEventoForm ? [String(fechaEventoForm)] : []);
    const serviciosFechasAuto = (this.selectedPaquetes || []).flatMap((item, index) => {
      const itemTmpId = item.tmpId ?? `i${index + 1}`;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      const fechas = fechasBase.slice(0, cantidad);
      return fechas.map(fecha => ({ itemTmpId, fecha }));
    });
    const tmpIds = new Set(this.selectedPaquetes.map(item => item.tmpId ?? ''));
    const serviciosFechas = this.isMultipleDias()
      ? this.serviciosFechasSeleccionadas.filter(entry =>
          tmpIds.has(entry.itemTmpId) && fechasBase.includes(entry.fecha)
        )
      : serviciosFechasAuto;
    if (this.isMultipleDias()) {
      for (const item of this.selectedPaquetes) {
        const itemTmpId = item.tmpId;
        const cantidad = Number(item.cantidad ?? 1) || 1;
        const asignadas = serviciosFechas.filter(entry => entry.itemTmpId === itemTmpId).length;
        if (asignadas !== cantidad) {
          Swal.fire({
            icon: 'warning',
            title: 'Asignación pendiente',
            text: 'Completa la asignación de fechas para todos los servicios.',
            confirmButtonText: 'Entendido'
          });
          return;
        }
      }
      const fechasSinAsignar = fechasBase.filter(
        fecha => !serviciosFechas.some(entry => entry.fecha === fecha)
      );
      if (fechasSinAsignar.length) {
        Swal.fire({
          icon: 'warning',
          title: 'Fechas sin asignar',
          text: 'Asigna al menos un servicio por cada fecha seleccionada.',
          confirmButtonText: 'Entendido'
        });
        return;
      }
    }

    const fechaCreacion = this.convert(this.fechaCreate);
    const toHms = (h: string | null | undefined) => (h || '').length === 5 ? `${h}:00` : (h || '');
    const lugar = (this.visualizarService.selectAgregarPedido?.departamento ?? '').toString().trim();
    const lugarLower = lugar.toLowerCase();
    const viaticosClienteFinal = lugarLower === 'lima'
      ? true
      : Boolean(this.visualizarService.selectAgregarPedido?.viaticosCliente);
    const viaticosMontoFinal = viaticosClienteFinal
      ? 0
      : (this.parseNumber(this.visualizarService.selectAgregarPedido?.viaticosMonto) ?? 0);
    const mensaje = (this.visualizarService.selectAgregarPedido as { mensaje?: string } | null)?.mensaje ?? '';
    const fechaEvento = this.shouldShowFechaEvento()
      ? (this.visualizarService.selectAgregarPedido?.fechaEvent ?? null)
      : null;

    const tmpIdToId = new Map<string, number>();
    this.selectedPaquetes.forEach(item => {
      if (item.id != null) {
        tmpIdToId.set(item.tmpId, item.id);
      }
    });
    const serviciosFechasPayload = serviciosFechas
      .map(entry => {
        const idPedidoServicio = tmpIdToId.get(entry.itemTmpId);
        return idPedidoServicio != null
          ? { idPedidoServicio, fecha: entry.fecha }
          : null;
      })
      .filter((entry): entry is { idPedidoServicio: number; fecha: string } => !!entry);

    const payload: PedidoUpdatePayload = {
      pedido: {
        clienteId: this.infoCliente.idCliente,
        empleadoId: this.CodigoEmpleado ?? 1,
        fechaCreacion: fechaCreacion,
        estadoPedidoId: this.estadoPedidoId ?? 1,
        estadoPagoId: this.estadoPagoId ?? 1,
        fechaEvento: fechaEvento,
        lugar: lugar,
        observaciones: this.visualizarService.selectAgregarPedido?.Observacion || '',
        idTipoEvento: this.eventoSeleccionado ?? 0,
        dias: this.visualizarService.selectAgregarPedido?.dias ?? 1,
        horasEstimadas: this.visualizarService.selectAgregarPedido?.horasEstimadas ?? null,
        viaticosMonto: viaticosMontoFinal,
        viaticosCliente: viaticosClienteFinal,
        mensaje: mensaje,
        nombrePedido: this.visualizarService.selectAgregarPedido?.NombrePedido || '',
        cotizacionId: this.cotizacionId,
        cliente: { documento: this.infoCliente.documento || '' }
      },
      eventos: (this.ubicacion || [])
        .filter(u => (u?.Direccion || '').trim())
        .map(u => ({
          id: (u.dbId ?? u.ID ?? null),
          clientEventKey: u.ID ?? null,
          fecha: String(u.Fecha || '').trim(),
          hora: toHms(String(u.Hora || '').trim()),
          ubicacion: String(u.Direccion || '').trim(),
          direccion: String(u.DireccionExacta || '').trim(),
          notas: String(u.Notas || '').trim()
        })),
      items: (this.selectedPaquetes || []).map(it => ({
        id: it.id ?? null,
        exsId: it.idEventoServicio ?? null,
        idEventoServicio: it.idEventoServicio ?? null,
        tmpId: it.tmpId,
        eventoId: it.eventoId ?? null,
        servicioId: it.servicioId ?? null,
        eventoCodigo: it.eventoCodigo ?? null,
        moneda: it.moneda ?? 'USD',
        nombre: String(it.nombre ?? '').trim(),
        descripcion: String(it.descripcion ?? '').trim(),
        precioUnit: Number(it.precioUnit ?? 0),
        cantidad: Number(it.cantidad ?? 1),
        descuento: Number(it.descuento ?? 0),
        recargo: Number(it.recargo ?? 0),
        horas: it.horas ?? null,
        personal: it.personal ?? null,
        fotosImpresas: it.fotosImpresas ?? null,
        trailerMin: it.trailerMin ?? null,
        filmMin: it.filmMin ?? null,
        notas: String(it.notas ?? '').trim()
      })),
      serviciosFechas: serviciosFechasPayload
    };

    // Validación de formatos ANTES de activar el candado
    const horaInvalida = payload.eventos.some(e => !/^\d{2}:\d{2}:\d{2}$/.test(e.hora));
    const fechaInvalida = payload.eventos.some(e => !/^\d{4}-\d{2}-\d{2}$/.test(e.fecha));
    if (horaInvalida || fechaInvalida) {
      Swal.fire({
        icon: 'warning',
        title: 'Formato inválido',
        text: 'Revisa el formato de fecha (YYYY-MM-DD) y hora (HH:mm:ss) en los eventos.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const diff = this.getPedidoChanges(this.initialSnapshotData, currentSnapshotData);
    if (diff.hasStrong) {
      void this.confirmStrongChanges(diff.items).then(confirmado => {
        if (!confirmado) {
          return;
        }
        this.enviarActualizacion(payload);
      });
      return;
    }

    this.enviarActualizacion(payload);
  }

  syncHora(item: UbicacionRow): void {
    const hora12 = item.hora12 ?? null;
    const minuto = item.minuto ?? null;
    const ampm = item.ampm ?? null;
    if (!hora12 || !minuto || !ampm) {
      item.Hora = '';
      return;
    }
    const base = Number(hora12) % 12;
    const hour24 = ampm === 'PM' ? base + 12 : base;
    item.Hora = `${String(hour24).padStart(2, '0')}:${minuto}`;
  }

  isHoraFueraRango(item: UbicacionRow): boolean {
    if (!item.Hora) return false;
    const parts = item.Hora.split(':');
    const hh = Number(parts[0] ?? 0);
    const mm = Number(parts[1] ?? 0);
    const total = (hh * 60) + mm;
    return total < (6 * 60) || total > (22 * 60);
  }

  private splitHoraParts(hora: string): { hora12: number | null; minuto: string | null; ampm: 'AM' | 'PM' | null } {
    if (!hora) {
      return { hora12: null, minuto: null, ampm: null };
    }
    const [hh, mm] = hora.split(':');
    const hour = Number(hh);
    if (!Number.isFinite(hour) || mm == null) {
      return { hora12: null, minuto: null, ampm: null };
    }
    const ampm: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';
    const hora12 = (hour % 12) || 12;
    return { hora12, minuto: mm, ampm };
  }

  private showToast(icon: AlertIcon, title: string, text?: string, timer = 2200): void {
    void Swal.fire({
      icon,
      title,
      text,
      toast: true,
      position: 'top-end',
      timer,
      timerProgressBar: true,
      showConfirmButton: false
    });
  }

  private showAlert(icon: AlertIcon, title: string, text?: string): void {
    void Swal.fire({
      icon,
      title,
      text,
      confirmButtonText: 'Entendido'
    });
  }

  private refreshSelectedPaquetesColumns(): void {
    const base: TableColumn<PedidoPaqueteSeleccionado>[] = [
      { key: 'titulo', header: 'Título', sortable: false },
      { key: 'precioUnit', header: 'Precio', sortable: false, class: 'text-end text-nowrap', width: '140px' },
    ];
    if (this.isMultipleDias()) {
      base.splice(1, 0, { key: 'cantidad', header: 'Cant.', sortable: false, class: 'text-center', width: '90px' });
    }
    if (this.shouldShowPrecioOriginal()) {
      base.push({ key: 'precioOriginal', header: 'Base', sortable: false, class: 'text-end text-nowrap', width: '140px' });
    }
    base.push(
      { key: 'horas', header: 'Horas', sortable: false, class: 'text-center', width: '100px' },
      { key: 'staff', header: 'Staff', sortable: false, class: 'text-center', width: '100px' },
      { key: 'subtotal', header: 'Subtotal', sortable: false, class: 'text-end text-nowrap', width: '140px' },
      { key: 'notas', header: 'Notas', sortable: false, filterable: false, width: '280px' },
      { key: 'quitar', header: 'Quitar', sortable: false, filterable: false, class: 'text-center', width: '90px' }
    );
    this.selectedPaquetesColumns = base;
  }

  private getPrecioInputIdFromKey(key: string | number): string {
    return `precio-input-${String(key).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  }

  private focusPrecioInput(key: string | number): void {
    const id = this.getPrecioInputIdFromKey(key);
    setTimeout(() => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  private normalizePaqueteRow(item: AnyRecord): PaqueteRow {
    const record = item as Record<string, unknown>;
    const precio = Number(record['precio']);
    const staffRecord = record['staff'] as Record<string, unknown> | undefined;
    const staff = staffRecord?.['total'] != null ? Number(staffRecord['total']) : null;
    const horas = record['horas'] != null ? Number(record['horas']) : null;

    return {
      titulo: String(record['titulo'] ?? ''),
      descripcion: String(record['descripcion'] ?? ''),
      precio: Number.isFinite(precio) ? precio : null,
      staff: Number.isFinite(staff) ? staff : null,
      horas: Number.isFinite(horas) ? horas : null,
      raw: item
    };
  }

  private toIsoDate(value: string | Date): string {
    if (!value) {
      return this.convert(new Date());
    }
    if (typeof value === 'string') {
      if (value.length >= 10) {
        return value.slice(0, 10);
      }
      return this.convert(value);
    }
    return this.convert(value);
  }

  private static computeFechaMinimaEvento(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return ActualizarPedidoComponent.formatIsoDate(date);
  }

  private static computeFechaMaximaEvento(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 6);
    return ActualizarPedidoComponent.formatIsoDate(date);
  }

  private static formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getFechaEventoError(): 'required' | 'fechaEventoAnterior' | 'fechaEventoPosterior' | 'fechaEventoInvalida' | null {
    if (!this.shouldShowFechaEvento()) {
      return null;
    }
    const raw = this.visualizarService.selectAgregarPedido?.fechaEvent;
    if (!raw) {
      return 'required';
    }
    const date = parseDateInput(raw);
    if (!date) {
      return 'fechaEventoInvalida';
    }
    const min = parseDateInput(this.fechaMinimaEvento);
    const max = parseDateInput(this.fechaMaximaEvento);
    if (!min || !max) {
      return null;
    }
    if (date < min) {
      return 'fechaEventoAnterior';
    }
    if (date > max) {
      return 'fechaEventoPosterior';
    }
    return null;
  }

  private buildSnapshotData(): PedidoSnapshot {
    const lugar = (this.visualizarService.selectAgregarPedido?.departamento ?? '').toString().trim();
    const lugarLower = lugar.toLowerCase();
    const viaticosCliente = lugarLower === 'lima'
      ? true
      : Boolean(this.visualizarService.selectAgregarPedido?.viaticosCliente);
    const viaticosMonto = viaticosCliente
      ? 0
      : (this.parseNumber(this.visualizarService.selectAgregarPedido?.viaticosMonto) ?? 0);
    const pedido = {
      nombrePedido: this.visualizarService.selectAgregarPedido?.NombrePedido || '',
      observaciones: this.visualizarService.selectAgregarPedido?.Observacion || '',
      viaticosCliente,
      viaticosMonto
    };
    const eventos = (this.ubicacion || [])
      .filter(u => (u?.Direccion || '').trim())
      .map(u => ({
        fecha: String(u.Fecha || '').trim(),
        hora: String(u.Hora || '').trim(),
        ubicacion: String(u.Direccion || '').trim(),
        direccion: String(u.DireccionExacta || '').trim(),
        notas: String(u.Notas || '').trim()
      }));
    const items = (this.selectedPaquetes || []).map(it => ({
      key: String(it.key),
      idEventoServicio: it.idEventoServicio ?? null,
      eventoId: it.eventoId ?? null,
      servicioId: it.servicioId ?? null,
      nombre: String(it.nombre ?? it.titulo ?? '').trim(),
      descripcion: String(it.descripcion ?? '').trim(),
      precio: Number(it.precio ?? 0),
      cantidad: Number(it.cantidad ?? 1),
      descuento: Number(it.descuento ?? 0),
      recargo: Number(it.recargo ?? 0)
    }));
    const serviciosFechas = [...(this.serviciosFechasSeleccionadas || [])]
      .map(entry => ({ itemTmpId: entry.itemTmpId, fecha: entry.fecha }))
      .sort((a, b) => {
        if (a.itemTmpId !== b.itemTmpId) {
          return a.itemTmpId.localeCompare(b.itemTmpId);
        }
        return a.fecha.localeCompare(b.fecha);
      });
    return { pedido, eventos, items, serviciosFechas };
  }

  private getPedidoChanges(
    anterior: PedidoSnapshot | null,
    actual: PedidoSnapshot
  ): { hasStrong: boolean; items: PedidoChangeItem[] } {
    if (!anterior) {
      return { hasStrong: false, items: [] };
    }

    const cambios: PedidoChangeItem[] = [];
    const nombreAntes = anterior.pedido.nombrePedido ?? '';
    const nombreAhora = actual.pedido.nombrePedido ?? '';
    if (nombreAntes !== nombreAhora) {
      cambios.push({
        label: 'Nombre del pedido',
        before: nombreAntes || '—',
        after: nombreAhora || '—',
        level: 'weak'
      });
    }

    const obsAntes = anterior.pedido.observaciones ?? '';
    const obsAhora = actual.pedido.observaciones ?? '';
    if (obsAntes !== obsAhora) {
      cambios.push({
        label: 'Mensaje del solicitante',
        before: obsAntes || '—',
        after: obsAhora || '—',
        level: 'weak'
      });
    }

    const viaticosClienteAntes = anterior.pedido.viaticosCliente;
    const viaticosClienteAhora = actual.pedido.viaticosCliente;
    const viaticosMontoAntes = anterior.pedido.viaticosMonto;
    const viaticosMontoAhora = actual.pedido.viaticosMonto;
    if (viaticosClienteAntes !== viaticosClienteAhora || viaticosMontoAntes !== viaticosMontoAhora) {
      const before = viaticosClienteAntes ? 'Cliente cubre viaticos' : `Monto: ${viaticosMontoAntes}`;
      const after = viaticosClienteAhora ? 'Cliente cubre viaticos' : `Monto: ${viaticosMontoAhora}`;
      cambios.push({
        label: 'Viaticos',
        before,
        after,
        level: 'strong'
      });
    }

    const eventosAntes = anterior.eventos ?? [];
    const eventosAhora = actual.eventos ?? [];
    const maxEventos = Math.max(eventosAntes.length, eventosAhora.length);
    for (let i = 0; i < maxEventos; i += 1) {
      const prev = eventosAntes[i];
      const next = eventosAhora[i];
      if (!prev && !next) continue;
      const nombrePrev = prev?.ubicacion ?? '';
      const nombreNext = next?.ubicacion ?? '';
      const prevSinNombre = this.eventoSinNombre(prev);
      const nextSinNombre = this.eventoSinNombre(next);
      const prevSinNombreNotas = this.eventoSinNombreNotas(prev);
      const nextSinNombreNotas = this.eventoSinNombreNotas(next);
      const cambioSoloNombre = JSON.stringify(prevSinNombre) === JSON.stringify(nextSinNombre)
        && nombrePrev !== nombreNext;
      const cambioSoloNotas = JSON.stringify(prevSinNombreNotas) === JSON.stringify(nextSinNombreNotas)
        && (prev?.notas ?? '') !== (next?.notas ?? '');
      if (!prev || !next || JSON.stringify(prev) !== JSON.stringify(next)) {
        cambios.push({
          label: `Locación ${i + 1}`,
          before: this.formatEventoResumen(prev),
          after: this.formatEventoResumen(next),
          level: (cambioSoloNombre || cambioSoloNotas) ? 'weak' : 'strong'
        });
      }
    }

    const prevItemsMap = new Map<string, PedidoItemSnapshot>();
    anterior.items.forEach(item => {
      prevItemsMap.set(String(item.key), item);
    });
    const nextItemsMap = new Map<string, PedidoItemSnapshot>();
    actual.items.forEach(item => {
      nextItemsMap.set(String(item.key), item);
    });
    const allKeys = new Set<string>([...prevItemsMap.keys(), ...nextItemsMap.keys()]);
    allKeys.forEach(key => {
      const prev = prevItemsMap.get(key);
      const next = nextItemsMap.get(key);
      if (!prev && !next) return;
      if (!prev || !next || JSON.stringify(prev) !== JSON.stringify(next)) {
        const label = prev?.nombre || next?.nombre || `Paquete ${key}`;
        cambios.push({
          label,
          before: this.formatItemResumen(prev),
          after: this.formatItemResumen(next),
          level: 'strong'
        });
      }
    });

    return { hasStrong: cambios.some(item => item.level === 'strong'), items: cambios };
  }

  private formatEventoResumen(evento?: PedidoEventoSnapshot): string {
    if (!evento) return '—';
    const fecha = evento.fecha ? this.formatFechaResumen(evento.fecha) : '—';
    const hora = evento.hora || '—';
    const ubicacion = evento.ubicacion || '—';
    const direccion = evento.direccion ? ` (${evento.direccion})` : '';
    const notas = evento.notas ? ` | ${evento.notas}` : '';
    return `${fecha} ${hora} - ${ubicacion}${direccion}${notas}`;
  }

  private formatFechaResumen(value: string): string {
    const parsed = parseDateInput(value);
    if (!parsed) {
      return value;
    }
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  private eventoSinNombre(evento?: PedidoEventoSnapshot): PedidoEventoSnapshot {
    return {
      fecha: evento?.fecha ?? '',
      hora: evento?.hora ?? '',
      ubicacion: '',
      direccion: evento?.direccion ?? '',
      notas: evento?.notas ?? ''
    };
  }

  private eventoSinNombreNotas(evento?: PedidoEventoSnapshot): PedidoEventoSnapshot {
    return {
      fecha: evento?.fecha ?? '',
      hora: evento?.hora ?? '',
      ubicacion: '',
      direccion: evento?.direccion ?? '',
      notas: ''
    };
  }

  private formatItemResumen(item?: PedidoItemSnapshot): string {
    if (!item) return '—';
    const precio = Number.isFinite(item.precio) ? item.precio.toFixed(2) : '0.00';
    const cantidad = item.cantidad ?? 1;
    return `Precio: ${precio} | Cant: ${cantidad}`;
  }

  private confirmStrongChanges(items: PedidoChangeItem[]): Promise<boolean> {
    const filas = items
      .map(item => `
        <li style="margin-bottom:6px;">
          <strong>${item.label}${item.level === 'weak' ? ' (cambio menor)' : ''}</strong><br>
          <span style="color:#6c757d;">Antes:</span> ${item.before}<br>
          <span style="color:#6c757d;">Ahora:</span> ${item.after}
        </li>
      `)
      .join('');
    return Swal.fire({
      icon: 'warning',
      title: 'Cambios importantes',
      html: `
        <p>Los cambios realizados harán que haya un desfase entre la cotización y el pedido, y esto afectará al contrato final.</p>
        <ul style="text-align:left; padding-left:18px; margin-top:8px; max-height:240px; overflow:auto;">
          ${filas}
        </ul>
      `,
      confirmButtonText: 'Guardar de todas formas',
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      reverseButtons: true
    }).then(result => result.isConfirmed);
  }

  private enviarActualizacion(payload: PedidoUpdatePayload): void {
    const obs = this.visualizarService.updatePedido?.(this.pedidoId, payload);
    if (!obs || typeof obs.subscribe !== 'function') {
      console.error('[updatePedido] no disponible');
      Swal.fire({
        icon: 'error',
        title: 'Error al actualizar',
        text: 'No se pudo enviar la actualización.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    this.saving = true; // ← activa el candado SOLO cuando ya vas a llamar al API

    obs.pipe(
      take(1),
      finalize(() => { this.saving = false; }) // ← libéralo siempre
    ).subscribe(
      () => {
        void Swal.fire({
          icon: 'success',
          title: 'Pedido actualizado',
          text: 'Los cambios se guardaron correctamente.'
        }).then(() => this.router.navigate(['/home/gestionar-pedido']));
      },
      (err: unknown) => {
        console.error('[updatePedido] error', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al actualizar',
          text: 'No pudimos actualizar el pedido.',
          confirmButtonText: 'Entendido'
        });
      }
    );
  }

  private parseNumber(value: unknown): number | null {
    if (value == null) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
}

interface PaqueteRow {
  titulo: string;
  descripcion: string;
  precio: number | null;
  staff: number | null;
  horas: number | null;
  raw: AnyRecord;
}

interface PaqueteDetalle {
  precio?: number;
  titulo?: string;
  horas?: number;
  categoriaNombre?: string;
  categoriaTipo?: string;
  esAddon?: boolean;
  descripcion?: string;
  staff?: number | { total?: number };
  personal?: number;
  fotosImpresas?: number;
  trailerMin?: number;
  filmMin?: number;
  servicio?: { nombre?: string };
  servicioNombre?: string;
  evento?: { nombre?: string };
  estado?: { nombre?: string };
  equipos?: AnyRecord[];
}

interface PedidoSnapshot {
  pedido: {
    nombrePedido: string;
    observaciones: string;
    viaticosCliente: boolean;
    viaticosMonto: number;
  };
  eventos: PedidoEventoSnapshot[];
  items: PedidoItemSnapshot[];
  serviciosFechas: PedidoServicioFecha[];
}

interface PedidoEventoSnapshot {
  fecha: string;
  hora: string;
  ubicacion: string;
  direccion: string;
  notas: string;
}

interface PedidoItemSnapshot {
  key: string;
  idEventoServicio: number | null;
  eventoId: number | null;
  servicioId: number | null;
  nombre: string;
  descripcion: string;
  precio: number;
  cantidad: number;
  descuento: number;
  recargo: number;
}

interface PedidoChangeItem {
  label: string;
  before: string;
  after: string;
  level: 'weak' | 'strong';
}
