import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl, UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, ValidatorFn, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, finalize, switchMap, takeUntil } from 'rxjs';
import { Cotizacion, CotizacionPayload, CotizacionItemPayload, CotizacionAdminItemPayload, CotizacionAdminUpdatePayload, CotizacionAdminEventoPayload, CotizacionAdminServicioFechaPayload } from '../model/cotizacion.model';
import { CotizacionService } from '../service/cotizacion.service';
import { formatIsoDate, parseDateInput } from '../../../shared/utils/date-utils';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

type AlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';
type AnyRecord = Record<string, unknown>;

interface PaqueteSeleccionado {
  key: string | number;
  tmpId: string;
  titulo: string;
  descripcion: string;
  precio: number;
  cantidad: number;
  moneda?: string;
  grupo?: string | null;
  opcion?: number | null;
  staff?: number | null;
  horas?: number | null;
  fotosImpresas?: number | null;
  trailerMin?: number | null;
  filmMin?: number | null;
  descuento?: number | null;
  recargo?: number | null;
  notas?: string;
  eventoServicioId?: number;
  servicioId?: number | null;
  servicioNombre?: string;
  origen?: unknown;
  precioOriginal: number;
  editandoPrecio?: boolean;
}

interface PaqueteRow {
  titulo: string;
  descripcion: string;
  precio: number | null;
  staff: number | null;
  horas: number | null;
  raw: AnyRecord;
}

interface ProgramacionEventoItemConfig {
  nombre?: string;
  direccion?: string;
  fecha?: string;
  hora?: string;
  notas?: string;
  esPrincipal?: boolean;
}

type ProgramacionEventoItem = ProgramacionEventoItemConfig & { esPrincipal: boolean };

interface EventoCatalogo {
  id: number;
  nombre: string;
  raw: AnyRecord;
}

type StaffDetalle = number | { total?: number };

interface PaqueteDetalle {
  precio?: number;
  titulo?: string;
  horas?: number;
  categoriaNombre?: string;
  categoriaTipo?: string;
  esAddon?: boolean;
  descripcion?: string;
  Descripcion?: string;
  personal?: number;
  fotosImpresas?: number;
  trailerMin?: number;
  filmMin?: number;
  servicioNombre?: string;
  servicio?: { nombre?: string };
  staff?: StaffDetalle;
  eventoServicio?: { staff?: StaffDetalle };
}

@Component({
  selector: 'app-editar-cotizacion',
  templateUrl: './editar-cotizacion.component.html',
  styleUrls: ['./editar-cotizacion.component.css']
})
export class EditarCotizacionComponent implements OnInit, OnDestroy {
  readonly fechaMinimaEvento = EditarCotizacionComponent.computeFechaMinimaEvento();
  readonly fechaMaximaEvento = EditarCotizacionComponent.computeFechaMaximaEvento();
  readonly horaOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly minutoOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
  readonly ampmOptions = ['AM', 'PM'] as const;
  readonly maxLocacionesPorDia = 6;

  form: UntypedFormGroup;

  servicios: AnyRecord[] = [];
  eventos: EventoCatalogo[] = [];
  selectedServicioId: number | null = null;
  selectedServicioNombre = '';
  selectedEventoId: number | null = null;
  selectedEventoNombre = '';
  selectedEventoIdValue = '';

  paquetesColumns: TableColumn<PaqueteRow>[] = [
    { key: 'titulo', header: 'Título', sortable: true, width: '45%' },
    { key: 'precio', header: 'Precio', sortable: true, class: 'text-center', width: '120px' },
    { key: 'horas', header: 'Horas', sortable: true, class: 'text-center', width: '100px' },
    { key: 'staff', header: 'Staff', sortable: true, class: 'text-center', width: '100px' },
    { key: 'acciones', header: 'Seleccionar', sortable: false, filterable: false, class: 'text-center', width: '200px' }
  ];
  paquetesRows: PaqueteRow[] = [];
  selectedPaquetes: PaqueteSeleccionado[] = [];
  selectedPaquetesColumns: TableColumn<PaqueteSeleccionado>[] = [];

  loadingCatalogos = false;
  loadingPaquetes = false;
  loading = true;
  saving = false;
  private initialSnapshot = '';
  detallePaqueteAbierto = false;
  detallePaqueteSeleccionado: PaqueteDetalle | null = null;
  asignacionFechasAbierta = false;
  fechasDisponibles: string[] = [];
  serviciosFechasSeleccionadas: CotizacionAdminServicioFechaPayload[] = [];
  private fechasTrabajoSnapshot: string[] = [];
  private lastDiasAplicado = 0;
  private diasChangeGuard = false;
  private programacionExpandida = new WeakMap<UntypedFormGroup, boolean>();
  private tmpIdSequence = 0;
  private lastDepartamento = '';
  private departamentoChangeLock = false;
  private viaticosChangeLock = false;
  private lastViaticosCliente: boolean | null = null;
  private lastViaticosMonto: number | null = null;

  private cotizacion: Cotizacion | null = null;
  private pendingServicioId: number | null = null;
  private pendingEventoId: number | null = null;
  private fechaEventoOriginal: string | null = null;

  private readonly destroy$ = new Subject<void>();
  readonly programacionMinimaRecomendada = 1;
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
  eventoSelectTouched = false;

  private readonly fb = inject(UntypedFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cotizacionService = inject(CotizacionService);

  constructor() {
    this.form = this.fb.group({
      clienteNombre: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(2)]],
      clienteContacto: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(6)]],
      fechaEvento: ['', [Validators.required, this.fechaEventoEnRangoValidator()]],
      dias: [null, [Validators.required, Validators.min(1), Validators.max(7)]],
      horasEstimadas: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1)]],
      departamento: ['', Validators.required],
      viaticosCliente: [true],
      viaticosMonto: [{ value: null, disabled: true }],
      descripcion: [''],
      totalEstimado: [{ value: 0, disabled: true }, Validators.min(0)],
      fechasTrabajo: this.fb.array([]),
      programacion: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.loadCatalogos();
    this.loadCotizacion();
    this.refreshSelectedPaquetesColumns();
    this.form.get('fechaEvento')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        const iso = this.normalizeDateForPayload(value);
        this.fechaEventoOriginal = iso ?? (typeof value === 'string' ? value : null);
        this.syncProgramacionFechas(value);
      });
    this.form.get('dias')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => this.onDiasChange(value));
    this.lastDepartamento = (this.form.get('departamento')?.value ?? '').toString().trim();
    this.form.get('departamento')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => this.handleDepartamentoChange(value));
    this.form.get('viaticosCliente')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => this.handleViaticosClienteChange(value));
    this.form.get('viaticosMonto')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncTotalEstimado());
    this.applyDiasRules(this.form.get('dias')?.value);
    this.lastDiasAplicado = this.normalizeDias(this.form.get('dias')?.value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get programacion(): UntypedFormArray {
    return this.form.get('programacion') as UntypedFormArray;
  }

  get fechasTrabajo(): UntypedFormArray {
    return this.form.get('fechasTrabajo') as UntypedFormArray;
  }

  get fechasTrabajoValores(): string[] {
    return this.fechasTrabajo.controls
      .map(control => (control.value ?? '').toString().trim())
      .filter(Boolean);
  }

  addProgramacionItem(fechaForzada?: string): void {
    const siguienteIndice = this.programacion.length + 1;
    const nombreAuto = `Locación ${siguienteIndice}`;
    const fechaConfig = this.getFechaProgramacionNuevaFila(fechaForzada);
    if (!fechaConfig) {
      this.showAlert('warning', 'Fecha requerida', 'Primero define una fecha de trabajo para agregar locaciones.');
      return;
    }
    const actuales = this.getProgramacionIndicesPorFecha(fechaConfig).length;
    if (actuales >= this.maxLocacionesPorDia) {
      this.showAlert(
        'warning',
        'Límite alcanzado',
        `Máximo ${this.maxLocacionesPorDia} locaciones por día (${this.formatFechaConDia(fechaConfig)}).`
      );
      return;
    }
    const grupo = this.createProgramacionItem({ nombre: nombreAuto, fecha: fechaConfig, esPrincipal: siguienteIndice <= this.programacionMinimaRecomendada });
    this.programacion.push(grupo);
    this.setProgramacionExpandida(grupo, this.programacion.length === 1);
    this.ensureProgramacionPrincipales();
    this.syncProgramacionFechas(fechaConfig);
    this.programacion.markAsDirty();
    this.programacion.updateValueAndValidity();
  }

  duplicarProgramacionItem(index: number): void {
    const grupo = this.programacion.at(index) as UntypedFormGroup | null;
    if (!grupo) {
      return;
    }
    const raw = grupo.getRawValue() as Record<string, unknown>;
    const fecha = (raw['fecha'] ?? '').toString().trim();
    if (!fecha) {
      return;
    }
    const actuales = this.getProgramacionIndicesPorFecha(fecha).length;
    if (actuales >= this.maxLocacionesPorDia) {
      this.showAlert('warning', 'Límite alcanzado', `Máximo ${this.maxLocacionesPorDia} locaciones por día.`);
      return;
    }
    const duplicado = this.createProgramacionItem({
      nombre: (raw['nombre'] ?? '').toString().trim(),
      direccion: (raw['direccion'] ?? '').toString().trim(),
      hora: (raw['hora'] ?? '').toString().trim(),
      notas: (raw['notas'] ?? '').toString().trim(),
      fecha,
      esPrincipal: false
    });
    this.programacion.insert(index + 1, duplicado);
    this.setProgramacionExpandida(duplicado, true);
    this.syncProgramacionFechas();
  }

  removeProgramacionItem(index: number): void {
    if (index < 0 || index >= this.programacion.length) {
      return;
    }
    const grupo = this.programacion.at(index) as UntypedFormGroup | null;
    const nombre = (grupo?.get('nombre')?.value ?? '').toString().trim() || `Locación ${index + 1}`;

    void Swal.fire({
      icon: 'warning',
      title: 'Eliminar locación',
      text: `¿Quieres eliminar "${nombre}" de la programación?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    }).then(result => {
      if (!result.isConfirmed) {
        return;
      }
      this.programacion.removeAt(index);
      this.ensureProgramacionPrincipales();
      this.syncProgramacionFechas();
      this.programacion.markAsDirty();
      this.programacion.updateValueAndValidity();
      this.showToast('success', 'Locación eliminada', 'Se eliminó la locación seleccionada.');
    });
  }

  get totalSeleccion(): number {
    const subtotal = this.selectedPaquetes.reduce((acc, item) => {
      const precio = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + (precio * cantidad);
    }, 0);
    return subtotal + this.getViaticosMontoTotal();
  }

  get totalPaquetes(): number {
    return this.selectedPaquetes.reduce((acc, item) => {
      const precio = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + (precio * cantidad);
    }, 0);
  }

  private getViaticosMontoTotal(): number {
    if (this.isDepartamentoLima()) {
      return 0;
    }
    const viaticosCliente = !!this.form.get('viaticosCliente')?.value;
    if (viaticosCliente) {
      return 0;
    }
    const monto = this.parseNumber(this.form.get('viaticosMonto')?.value);
    return monto != null && monto > 0 ? monto : 0;
  }

  private getTotalCantidadSeleccionada(): number {
    return this.selectedPaquetes.reduce((acc, item) => {
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + cantidad;
    }, 0);
  }

  onServicioDropdownChange(rawValue: string): void {
    this.onServicioChange(this.parseNumber(rawValue));
  }

  onServicioChange(servicioId: number | null | undefined): void {
    const parsed = this.parseNumber(servicioId);
    this.selectedServicioId = parsed ?? null;
    if (this.selectedServicioId == null) {
      this.selectedServicioNombre = '';
    } else {
      const selected = this.servicios.find(s => this.getId(s) === this.selectedServicioId);
      this.selectedServicioNombre = this.getNombre(selected);
    }
    this.loadEventosServicio();
  }

  onEventoDropdownChange(event: Event): void {
    this.eventoSelectTouched = true;
    const target = event.target as HTMLSelectElement | null;
    const rawValue = target?.value ?? '';
    const nextEventoId = this.parseNumber(rawValue);
    const prevEventoId = this.selectedEventoId;
    const prevValue = prevEventoId != null ? String(prevEventoId) : '';
    if (this.selectedPaquetes.length && nextEventoId !== this.selectedEventoId) {
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
            target.value = prevValue;
          }
          this.selectedEventoIdValue = prevValue;
          return;
        }
        this.selectedPaquetes = [];
        this.serviciosFechasSeleccionadas = [];
        this.tmpIdSequence = 0;
        this.refreshSelectedPaquetesColumns();
        this.onEventoChange(nextEventoId);
      });
      return;
    }
    this.onEventoChange(nextEventoId);
  }

  onEventoModelChange(nextEventoId: number | null): void {
    this.eventoSelectTouched = true;
    const prevEventoId = this.selectedEventoId;

    if (this.selectedPaquetes.length && nextEventoId !== prevEventoId) {
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
          return;
        }
        this.selectedPaquetes = [];
        this.serviciosFechasSeleccionadas = [];
        this.tmpIdSequence = 0;
        this.refreshSelectedPaquetesColumns();
        this.onEventoChange(nextEventoId);
      });
      return;
    }

    this.onEventoChange(nextEventoId);
  }

  onEventoChange(eventoId: number | null | undefined): void {
    const parsed = this.parseNumber(eventoId);
    this.selectedEventoId = parsed ?? null;
    this.selectedEventoIdValue = this.selectedEventoId != null ? String(this.selectedEventoId) : '';
    if (this.selectedEventoId == null) {
      this.selectedEventoNombre = '';
    } else {
      const selected = this.eventos.find(e => e.id === this.selectedEventoId);
      this.selectedEventoNombre = this.getNombre(selected);
    }
    this.loadEventosServicio();
  }

  addPaquete(element: AnyRecord): void {
    const key = this.getPkgKey(element);
    if (this.selectedPaquetes.some(p => p.key === key)) {
      return;
    }
    const eventoServicioId = this.getEventoServicioId(element);
    const servicioId = this.getPaqueteServicioId(element);
    const servicioNombre = this.getPaqueteServicioNombre(element);
    const horas = this.getHoras(element);
    const staff = this.getStaff(element);
    const fotosImpresas = this.getFotosImpresas(element);
    const trailerMin = this.getTrailerMin(element);
    const filmMin = this.getFilmMin(element);
    const titulo = this.getTitulo(element);
    const descripcion = this.getDescripcion(element);
    const moneda = this.getMoneda(element);
    const grupo = this.getGrupo(element);
    const opcion = this.getOpcion(element);
    const descuento = this.getDescuento(element);
    const recargo = this.getRecargo(element);
    const precioBase = Number(element?.precio ?? element?.Precio ?? 0) || 0;
    const servicioNombreActual = (servicioNombre ?? this.selectedServicioNombre ?? '').toLowerCase();
    const esMismoServicio = (item: PaqueteSeleccionado): boolean => {
      if (servicioId != null) {
        return (item.servicioId ?? null) === servicioId;
      }
      return (item.servicioId ?? null) == null &&
        (item.servicioNombre ?? '').toLowerCase() === servicioNombreActual;
    };
    const reemplazados = this.selectedPaquetes.filter(esMismoServicio);
    const restantes = this.selectedPaquetes.filter(item => !esMismoServicio(item));
    const cantidadMaxima = this.getCantidadMaximaPorDias();
    const cantidadBase = Math.max(1, Number(reemplazados[0]?.cantidad ?? 1) || 1);
    const cantidadInicial = cantidadMaxima != null ? Math.min(cantidadBase, cantidadMaxima) : cantidadBase;
    const nextTmpId = `i${this.tmpIdSequence + 1}`;

    this.selectedPaquetes = [
      ...restantes,
      {
        key,
        tmpId: nextTmpId,
        titulo,
        descripcion,
        precio: precioBase,
        cantidad: cantidadInicial,
        moneda: moneda ?? undefined,
        grupo,
        opcion,
        staff: staff ?? undefined,
        horas: horas ?? undefined,
        fotosImpresas: fotosImpresas ?? undefined,
        trailerMin: trailerMin ?? undefined,
        filmMin: filmMin ?? undefined,
        descuento,
        recargo,
        notas: '',
        eventoServicioId: eventoServicioId ?? undefined,
        servicioId: servicioId ?? undefined,
        servicioNombre: servicioNombre ?? this.selectedServicioNombre ?? undefined,
        origen: element,
        precioOriginal: precioBase,
        editandoPrecio: false
      }
    ];
    this.tmpIdSequence += 1;
    if (this.serviciosFechasSeleccionadas.length) {
      const replacedTmpIds = new Set(reemplazados.map(item => item.tmpId));
      const tmpIds = new Set(this.selectedPaquetes.map(item => item.tmpId));
      const migradas = this.serviciosFechasSeleccionadas
        .map(entry => replacedTmpIds.has(entry.itemTmpId) ? { ...entry, itemTmpId: nextTmpId } : entry)
        .filter(entry => tmpIds.has(entry.itemTmpId));
      const nuevas = migradas.filter(entry => entry.itemTmpId === nextTmpId).slice(0, cantidadInicial);
      this.serviciosFechasSeleccionadas = [
        ...migradas.filter(entry => entry.itemTmpId !== nextTmpId),
        ...nuevas
      ];
    }
    this.syncTotalEstimado();
  }

  private asRecord(value: unknown): AnyRecord {
    return value && typeof value === 'object' ? (value as AnyRecord) : {};
  }

  private getNombre(value: unknown): string {
    const record = this.asRecord(value);
    return typeof record['nombre'] === 'string' ? record['nombre'] : '';
  }

  removePaquete(key: string | number): void {
    const removed = this.selectedPaquetes.find(p => p.key === key);
    this.selectedPaquetes = this.selectedPaquetes.filter(p => p.key !== key);
    if (removed?.tmpId) {
      this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry => entry.itemTmpId !== removed.tmpId);
    }
    this.syncTotalEstimado();
  }

  mostrarDetallePaquete(row: PaqueteRow): void {
    this.detallePaqueteSeleccionado = (row?.raw as PaqueteDetalle) ?? null;
    this.detallePaqueteAbierto = !!this.detallePaqueteSeleccionado;
  }

  cerrarDetallePaquete(): void {
    this.detallePaqueteAbierto = false;
    this.detallePaqueteSeleccionado = null;
  }

  abrirAsignacionFechas(): void {
    if (!this.isMultipleDias()) {
      return;
    }
    const fechasUnicas = Array.from(new Set(
      (this.programacion.getRawValue() as Record<string, unknown>[])
        .map((config) => (config['fecha'] ?? '').toString().trim())
        .filter(Boolean)
    )).sort();
    this.fechasDisponibles = fechasUnicas.length
      ? fechasUnicas
      : (this.form.get('fechaEvento')?.value ? [String(this.form.get('fechaEvento')?.value)] : []);
    if (!this.fechasDisponibles.length) {
      this.showAlert('warning', 'Fechas pendientes', 'Registra fechas en la programación para asignarlas a los servicios.');
      return;
    }
    this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry =>
      this.fechasDisponibles.includes(entry.fecha)
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
        this.showAlert('info', 'Cantidad completa', 'Ya asignaste todas las fechas requeridas para este servicio.');
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
    const eventoStaff = paquete.eventoServicio?.staff;
    const eventoTotal = typeof eventoStaff === 'number' ? eventoStaff : eventoStaff?.total;
    const total = staff?.total ?? eventoTotal ?? paquete.personal;
    return total ?? '—';
  }

  pkgKey = (el: AnyRecord) => this.getPkgKey(el);

  isInSeleccion(element: AnyRecord): boolean {
    const key = this.getPkgKey(element);
    return this.selectedPaquetes.some(p => p.key === key);
  }

  hasOtroPaqueteDelServicio(element: AnyRecord): boolean {
    const servicioId = this.getPaqueteServicioId(element);
    if (servicioId == null) {
      const servicioNombre = this.getPaqueteServicioNombre(element);
      if (!servicioNombre) {
        return false;
      }
      const key = this.getPkgKey(element);
      const nombreComparacion = servicioNombre.toLowerCase();
      return this.selectedPaquetes.some(p =>
        (p.servicioId ?? null) == null &&
        (p.servicioNombre ?? '').toLowerCase() === nombreComparacion &&
        p.key !== key
      );
    }
    const key = this.getPkgKey(element);
    return this.selectedPaquetes.some(p => (p.servicioId ?? null) === servicioId && p.key !== key);
  }

  shouldShowPrecioOriginal(): boolean {
    return false;
  }

  isPrecioModificado(paquete: PaqueteSeleccionado): boolean {
    const actual = Number(paquete.precio ?? 0);
    const original = Number(paquete.precioOriginal ?? actual);
    if (!Number.isFinite(actual) || !Number.isFinite(original)) {
      return false;
    }
    return Math.abs(actual - original) > 0.009;
  }

  getDescuentoPorcentaje(paquete: PaqueteSeleccionado): number | null {
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

  enablePrecioEdit(paquete: PaqueteSeleccionado): void {
    const key = paquete.key;
    this.selectedPaquetes = this.selectedPaquetes.map(item =>
      item.key === key ? { ...item, editandoPrecio: true } : item
    );
    this.focusPrecioInput(key);
  }

  confirmPrecioEdit(paquete: PaqueteSeleccionado, rawValue: string | number | null | undefined): void {
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
    this.syncTotalEstimado();
  }

  cancelPrecioEdit(paquete: PaqueteSeleccionado): void {
    const key = paquete.key;
    this.selectedPaquetes = this.selectedPaquetes.map(item =>
      item.key === key ? { ...item, editandoPrecio: false } : item
    );
  }

  onCantidadChange(paquete: PaqueteSeleccionado, value: unknown): void {
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
        if (count < paquete.cantidad) {
          count += 1;
          return true;
        }
        return false;
      });
    }
    this.syncTotalEstimado();
  }

  getPrecioInputId(paquete: PaqueteSeleccionado): string {
    return this.getPrecioInputIdFromKey(paquete.key);
  }

  getPrecioMinimo(paquete: PaqueteSeleccionado): number {
    const base = Number(paquete.precioOriginal ?? paquete.precio ?? 0);
    if (!Number.isFinite(base) || base <= 0) {
      return 0;
    }
    return Number((base * 0.95).toFixed(2));
  }

  update(): void {
    if (!this.cotizacion) {
      return;
    }
    if (this.initialSnapshot && this.initialSnapshot === this.buildSnapshot()) {
      this.router.navigate(['/home/gestionar-cotizaciones']);
      return;
    }

    const programacionInvalida = this.programacion.invalid;
    const programacionVacia = this.programacion.length === 0;
    if (this.form.invalid || programacionInvalida || programacionVacia) {
      this.form.markAllAsTouched();
      this.programacion.markAllAsTouched();
      const mensaje = programacionVacia
        ? 'Agrega al menos una locación.'
        : programacionInvalida
          ? 'Completa la programación del evento.'
          : 'Revisa los campos obligatorios.';
      this.showAlert('warning', 'Falta información', mensaje);
      return;
    }

    if (!this.selectedPaquetes.length) {
      this.showAlert('warning', 'Agrega paquetes', 'Selecciona al menos un paquete para la cotización.');
      return;
    }

    const raw = this.form.getRawValue();
    const diasNumero = this.parseNumber(raw.dias);
    const restriccionesProgramacion = this.validarRestriccionesProgramacion(diasNumero);
    if (restriccionesProgramacion.length) {
      this.showAlertHtml(
        'warning',
        'Revisa la programación',
        `<ul class="text-start mb-0">${restriccionesProgramacion.map(err => `<li>${err}</li>`).join('')}</ul>`
      );
      this.expandirProgramacionConErrores();
      return;
    }
    if (diasNumero != null && diasNumero > 2) {
      const totalCantidad = this.getTotalCantidadSeleccionada();
      if (totalCantidad < diasNumero) {
        this.showAlert(
          'warning',
          'Cantidades insuficientes',
          `Para ${diasNumero} días debes asignar al menos ${diasNumero} servicios en total.`
        );
        return;
      }
    }
    const rawPayload = (this.cotizacion.raw as CotizacionPayload | undefined);
    const rawDetalle = rawPayload?.cotizacion;
    const rawContexto = rawPayload?.contexto;
    const eventoSeleccionadoId = this.selectedEventoId ?? rawDetalle?.eventoId ?? this.cotizacion?.eventoId ?? null;
    this.eventoSelectTouched = eventoSeleccionadoId == null;
    if (this.eventoSelectTouched) {
      this.showAlert('warning', 'Selecciona un evento', 'Elige un tipo de evento para continuar.');
      return;
    }

    const clienteNombre = (raw.clienteNombre ?? '').toString().trim();
    const horasEstimadas = (raw.horasEstimadas ?? '').toString().trim();
    const descripcionBase = (raw.descripcion ?? '').toString().trim();
    const descripcion = descripcionBase || (clienteNombre ? `Solicitud de cotización de ${clienteNombre}` : 'Solicitud de cotización');
    const fechaEventoBase = this.normalizeDateForPayload(raw.fechaEvento) ??
      this.normalizeDateForPayload(this.fechaEventoOriginal);
    if (!fechaEventoBase && !this.isMultipleDias()) {
      this.showAlert('error', 'Fecha inválida', 'No pudimos interpretar la fecha del evento.');
      return;
    }
    const departamento = (raw.departamento ?? '').toString().trim();
    const viaticosCliente = Boolean(raw.viaticosCliente);
    const viaticosMonto = this.parseNumber(raw.viaticosMonto);
    const clienteId = rawContexto?.clienteId;
    const horasEstimadasNumero = this.parseHorasToNumber(horasEstimadas ?? rawContexto?.horasEstimadasTexto);
    const diasTexto = (raw.dias ?? '').toString().trim();
    const diasNumeroTexto = this.parseNumber(diasTexto);

    const items: CotizacionAdminItemPayload[] = this.selectedPaquetes.map((item, index) => {
      const notas = (item.notas ?? '').toString().trim();
      const eventoServicioId = this.getEventoServicioId(item) ?? this.getEventoServicioId(item.origen);
      const servicioId = this.getPaqueteServicioId(item);
      const horasItem = this.parseNumber(item.horas ?? this.getHoras(item.origen));
      const staffItem = this.parseNumber(item.staff ?? this.getStaff(item.origen));
      const fotosImpresas = this.parseNumber(item.fotosImpresas ?? this.getFotosImpresas(item.origen));
      const trailerMin = this.parseNumber(item.trailerMin ?? this.getTrailerMin(item.origen));
      const filmMin = this.parseNumber(item.filmMin ?? this.getFilmMin(item.origen));

      return {
        tmpId: item.tmpId ?? `i${index + 1}`,
        idEventoServicio: eventoServicioId ?? undefined,
        eventoId: eventoSeleccionadoId ?? undefined,
        servicioId: servicioId ?? undefined,
        titulo: item.titulo,
        descripcion: item.descripcion || undefined,
        moneda: item.moneda ?? this.getMoneda(item.origen) ?? 'USD',
        precioUnitario: Number(item.precio) || 0,
        cantidad: Number(item.cantidad ?? 1) || 1,
        notas: notas || undefined,
        horas: horasItem ?? undefined,
        personal: staffItem ?? undefined,
        fotosImpresas: fotosImpresas ?? undefined,
        trailerMin: trailerMin ?? undefined,
        filmMin: filmMin ?? undefined
      } as CotizacionAdminItemPayload;
    });

    const programacionRaw = this.programacion.getRawValue() as ProgramacionEventoItemConfig[];
    const eventos: CotizacionAdminEventoPayload[] = programacionRaw
      .filter(config => this.hasProgramacionContent(config))
      .map(config => {
        const fechaNormalizada = this.normalizeProgramacionFecha(config.fecha) ?? fechaEventoBase;
        const horaBase = this.normalizeProgramacionHora(config.hora);
        const horaSalida = horaBase
          ? (/^\d{2}:\d{2}$/.test(horaBase) ? `${horaBase}:00` : horaBase)
          : undefined;
        const ubicacion = (config.nombre ?? '').toString().trim();
        const direccion = (config.direccion ?? '').toString().trim();
        const notasTexto = (config.notas ?? '').toString().trim();
        return {
          fecha: fechaNormalizada ?? undefined,
          hora: horaSalida,
          ubicacion: ubicacion || undefined,
          direccion: direccion || undefined,
          notas: notasTexto ? notasTexto : null
        } as CotizacionAdminEventoPayload;
      });
    if (diasNumeroTexto != null && diasNumeroTexto > 1) {
      const fechasUnicas = new Set(
        programacionRaw
          .map(config => (config.fecha ?? '').toString().trim())
          .filter(Boolean)
      );
      if (fechasUnicas.size < diasNumeroTexto) {
        this.showAlert(
          'warning',
          'Fechas insuficientes',
          `Para ${diasNumeroTexto} días de trabajo debes registrar al menos ${diasNumeroTexto} fechas diferentes en las locaciones.`
        );
        return;
      }
      if (fechasUnicas.size > diasNumeroTexto) {
        this.showAlert(
          'warning',
          'Fechas excedidas',
          `Tienes ${fechasUnicas.size} fechas diferentes. Reduce a ${diasNumeroTexto} fechas para continuar.`
        );
        return;
      }
    }
    const fechaEvento = this.isMultipleDias()
      ? (eventos.find(ev => ev.fecha)?.fecha ?? undefined)
      : fechaEventoBase;

    const fechasUnicas = Array.from(new Set(
      programacionRaw
        .map((config) => (config.fecha ?? '').toString().trim())
        .filter(Boolean)
    )).sort();
    const fechasBase = fechasUnicas.length ? fechasUnicas : (fechaEventoBase ? [String(fechaEventoBase)] : []);
    const serviciosFechasAuto = items.flatMap((item, index) => {
      const itemTmpId = item.tmpId ?? `i${index + 1}`;
      const cantidad = Math.max(1, Number(item.cantidad ?? 1) || 1);
      const fechas = fechasBase.slice(0, cantidad);
      return fechas.map(fecha => ({ itemTmpId, fecha }));
    });
    const serviciosFechas = this.isMultipleDias()
      ? this.serviciosFechasSeleccionadas.filter(entry =>
          items.some(item => (item.tmpId ?? '') === entry.itemTmpId)
        )
      : serviciosFechasAuto;

    if (this.isMultipleDias()) {
      const pendiente = items.find((item, index) => {
        const itemTmpId = item.tmpId ?? `i${index + 1}`;
        const cantidad = Math.max(1, Number(item.cantidad ?? 1) || 1);
        const asignadas = serviciosFechas.filter(entry => entry.itemTmpId === itemTmpId).length;
        return asignadas !== cantidad;
      });
      if (pendiente) {
        this.showAlert(
          'warning',
          'Asignación pendiente',
          'Completa la asignación de fechas para todos los servicios.'
        );
        return;
      }
      const fechasSinAsignar = fechasBase.filter(
        fecha => !serviciosFechas.some(entry => entry.fecha === fecha)
      );
      if (fechasSinAsignar.length) {
        this.showAlert(
          'warning',
          'Fechas sin cobertura',
          'Debes asignar al menos un servicio a cada día.'
        );
        return;
      }
    }

    const payload: CotizacionAdminUpdatePayload = {
      cotizacion: {
        idTipoEvento: eventoSeleccionadoId ?? undefined,
        tipoEvento: this.selectedEventoNombre || rawContexto?.eventoNombre || rawDetalle?.tipoEvento || this.selectedServicioNombre,
        fechaEvento: fechaEvento ?? undefined,
        lugar: departamento || rawDetalle?.lugar,
        dias: diasNumeroTexto ?? undefined,
        horasEstimadas: horasEstimadasNumero ?? undefined,
        mensaje: descripcion,
        estado: rawDetalle?.estado ?? this.cotizacion?.estado ?? 'Borrador',
        viaticosCliente: departamento.toLowerCase() === 'lima' ? true : viaticosCliente,
        viaticosMonto: departamento.toLowerCase() === 'lima'
          ? undefined
          : (viaticosCliente ? undefined : (viaticosMonto ?? undefined))
      },
      items,
      serviciosFechas: serviciosFechas.length ? serviciosFechas : undefined,
      eventos: eventos.length ? eventos : undefined
    };

    if (clienteId != null) {
      payload.cliente = { id: clienteId };
    }


    this.saving = true;
    this.cotizacionService.updateCotizacion(this.cotizacion.id, payload)
      .pipe(
        finalize(() => this.saving = false),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          void Swal.fire({
            icon: 'success',
            title: 'Cotización actualizada',
            text: 'Los cambios se guardaron correctamente.'
          }).then(() => this.router.navigate(['/home/gestionar-cotizaciones']));
        },
        error: (err) => {
          console.error('[cotizacion] update', err);
          this.showAlert('error', 'Error al actualizar', 'No pudimos actualizar la cotización.');
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/home/gestionar-cotizaciones']);
  }

  private loadCatalogos(): void {
    this.loadingCatalogos = true;

    this.cotizacionService.getServicios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: servicios => {
          this.servicios = Array.isArray(servicios) ? servicios : [];
          this.loadingCatalogos = false;
          if (!this.servicios.length) {
            this.selectedServicioId = null;
            this.selectedServicioNombre = '';
          }
          this.applyPendingSelections();
        },
        error: (err) => {
          console.error('[cotizacion] servicios', err);
          this.servicios = [];
          this.loadingCatalogos = false;
          this.selectedServicioId = null;
          this.selectedServicioNombre = '';
          this.applyPendingSelections();
        }
      });

    this.cotizacionService.getEventos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: eventos => {
          this.eventos = Array.isArray(eventos)
            ? eventos.map(ev => this.normalizeEventoCatalogo(ev)).filter((ev): ev is EventoCatalogo => ev != null)
            : [];
          if (!this.eventos.length) {
            this.selectedEventoId = null;
            this.selectedEventoIdValue = '';
            this.selectedEventoNombre = '';
          }
          this.applyPendingSelections();
        },
        error: (err) => {
          console.error('[cotizacion] eventos', err);
          this.eventos = [];
          this.selectedEventoId = null;
          this.selectedEventoIdValue = '';
          this.selectedEventoNombre = '';
          this.applyPendingSelections();
        }
      });
  }

  private loadCotizacion(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = Number(params.get('id'));
          return this.cotizacionService.getCotizacion(id);
        })
      )
      .subscribe({
        next: cotizacion => {
          this.cotizacion = cotizacion;
          this.populateForm(cotizacion);
          this.loading = false;
        },
        error: (err) => {
          console.error('[cotizacion] load', err);
          this.showAlert('error', 'Error al cargar', 'No pudimos cargar la cotización.');
          this.router.navigate(['/home/gestionar-cotizaciones']);
        }
      });
  }

  private populateForm(cotizacion: Cotizacion): void {
    const raw = cotizacion.raw as CotizacionPayload | undefined;
    const contactoRaw = raw?.contacto;
    const detalle = raw?.cotizacion;
    const contexto = raw?.contexto;

    const nombre = (contactoRaw?.nombre ?? cotizacion.cliente ?? '').toString().trim();
    const contacto = (contactoRaw?.celular ?? cotizacion.contactoResumen ?? '').toString().trim();
    this.fechaEventoOriginal = detalle?.fechaEvento ?? cotizacion.fecha ?? null;
    const fechaEventoIso = this.normalizeDateForPayload(this.fechaEventoOriginal) ?? '';
    const horasEstimadasNumero = this.parseHorasToNumber(contexto?.horasEstimadasTexto)
      ?? (detalle?.horasEstimadas != null ? Number(detalle.horasEstimadas) : undefined)
      ?? this.parseHorasToNumber(cotizacion.horasEstimadas ?? '');
    const horasTexto = horasEstimadasNumero != null && Number.isFinite(horasEstimadasNumero)
      ? String(horasEstimadasNumero)
      : '';
    const departamento = this.pickFirstString(detalle?.lugar, cotizacion.lugar);
    const detalleRecord = this.asRecord(detalle);
    const cotizacionRecord = this.asRecord(cotizacion as unknown);
    const viaticosCliente = detalleRecord['viaticosCliente'] ?? cotizacionRecord['viaticosCliente'];
    const viaticosMonto = this.parseNumber(
      detalleRecord['viaticosMonto']
        ?? cotizacionRecord['viaticosMonto']
        ?? cotizacionRecord['viaticos_monto']
    );
    const viaticosClienteFinal = typeof viaticosCliente === 'boolean'
      ? viaticosCliente
      : (viaticosMonto == null || viaticosMonto === 0);
    if (departamento && !this.departamentos.includes(departamento)) {
      this.departamentos.push(departamento);
    }

    this.form.patchValue({
      clienteNombre: nombre,
      clienteContacto: contacto,
      fechaEvento: fechaEventoIso,
      dias: this.parseNumber(detalle?.dias ?? (cotizacion as unknown as AnyRecord)['dias'] ?? '') ?? '',
      horasEstimadas: horasTexto,
      departamento,
      viaticosCliente: viaticosClienteFinal,
      viaticosMonto: viaticosClienteFinal ? null : (viaticosMonto ?? null),
      descripcion: detalle?.mensaje ?? cotizacion.notas ?? '',
      totalEstimado: detalle?.totalEstimado ?? cotizacion.total ?? 0
    }, { emitEvent: false });
    this.lastDepartamento = (this.form.get('departamento')?.value ?? '').toString().trim();
    this.applyViaticosRules();
    this.syncViaticosSnapshot();

    const servicioId = this.parseNumber(contexto?.servicioId ?? cotizacion.servicioId);
    this.pendingServicioId = servicioId != null && servicioId > 0 ? servicioId : null;
    const itemsBase = (raw?.items ?? cotizacion.items ?? []) as unknown[];
    const eventoId = this.parseNumber(detalle?.idTipoEvento);
    this.pendingEventoId = eventoId != null && eventoId > 0 ? eventoId : null;
    this.selectedServicioId = this.pendingServicioId;
    this.selectedServicioNombre = contexto?.servicioNombre ?? cotizacion.servicio ?? '';
    this.selectedEventoId = this.pendingEventoId;
    this.selectedEventoIdValue = this.selectedEventoId != null ? String(this.selectedEventoId) : '';
    this.selectedEventoNombre = detalle?.tipoEvento ?? '';
    this.selectedPaquetes = itemsBase.map((item, index) => {
      const record = this.asRecord(item);
      const itemPayload = item as CotizacionItemPayload;
      const precioUnitario = Number(itemPayload.precioUnitario ?? 0) || 0;
      const cantidad = Number(itemPayload.cantidad ?? 1) || 1;
      const paqueteServicioId = this.parseNumber(itemPayload.servicioId);
      const paqueteServicioNombre = this.selectedServicioNombre || cotizacion.servicio || undefined;
      const idCotizacionServicio = itemPayload.idCotizacionServicio;
      return {
        key: this.getPkgKey(item),
        tmpId: idCotizacionServicio != null ? `i${idCotizacionServicio}` : `i${index + 1}`,
        titulo: itemPayload.titulo,
        descripcion: itemPayload.descripcion ?? itemPayload.titulo,
        precio: precioUnitario,
        cantidad,
        moneda: itemPayload.moneda ?? undefined,
        grupo: itemPayload.grupo ?? null,
        opcion: this.parseNumber(itemPayload.opcion) ?? index + 1,
        eventoServicioId: itemPayload.idEventoServicio ?? undefined,
        notas: itemPayload.notas,
        horas: itemPayload.horas ?? undefined,
        staff: itemPayload.personal ?? undefined,
        fotosImpresas: itemPayload.fotosImpresas ?? undefined,
        trailerMin: itemPayload.trailerMin ?? undefined,
        filmMin: itemPayload.filmMin ?? undefined,
        descuento: itemPayload.descuento ?? null,
        recargo: itemPayload.recargo ?? null,
        servicioId: paqueteServicioId,
        servicioNombre: paqueteServicioNombre ?? contexto?.servicioNombre ?? cotizacion.servicio ?? undefined,
        origen: item,
        precioOriginal: Number(record['precioOriginal'] ?? precioUnitario) || precioUnitario,
        editandoPrecio: false
      };
    });
    this.tmpIdSequence = this.selectedPaquetes.reduce((acc, item) => {
      const match = /^i(\d+)$/.exec(item.tmpId);
      const val = match ? Number(match[1]) : 0;
      return Math.max(acc, Number.isFinite(val) ? val : 0);
    }, 0);

    const rawRecord = this.asRecord(raw ?? cotizacion.raw);
    const serviciosFechasRaw = rawRecord['serviciosFechas'];
    if (Array.isArray(serviciosFechasRaw)) {
      this.serviciosFechasSeleccionadas = serviciosFechasRaw
        .map(entry => {
          const record = this.asRecord(entry);
          const fecha = String(record['fecha'] ?? '').trim();
          const idCotizacionServicio = this.parseNumber(record['idCotizacionServicio']);
          if (!fecha || idCotizacionServicio == null) {
            return null;
          }
          return {
            itemTmpId: `i${idCotizacionServicio}`,
            fecha
          };
        })
        .filter((entry): entry is CotizacionAdminServicioFechaPayload => entry != null);
    } else {
      this.serviciosFechasSeleccionadas = [];
    }

    const programacionEventos = this.extractProgramacionEventos(cotizacion, raw);
    this.populateProgramacion(programacionEventos);
    const fechasProgramacion = Array.from(new Set(
      (this.programacion.getRawValue() as ProgramacionEventoItemConfig[])
        .map(config => (config.fecha ?? '').toString().trim())
        .filter(Boolean)
    )).sort();
    this.fechasTrabajoSnapshot = fechasProgramacion.length
      ? fechasProgramacion
      : (fechaEventoIso ? [fechaEventoIso] : []);

    this.syncTotalEstimado();
    this.applyPendingSelections();
    this.programacion.markAsPristine();
    this.programacion.markAsUntouched();
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.applyDiasRules(this.form.get('dias')?.value);
    this.lastDiasAplicado = this.normalizeDias(this.form.get('dias')?.value);
    this.applyViaticosRules();
    this.initialSnapshot = this.buildSnapshot();
  }

  private buildSnapshot(): string {
    const formRaw = this.form.getRawValue();
    const programacionRaw = this.programacion.getRawValue() as ProgramacionEventoItemConfig[];
    const paquetes = this.selectedPaquetes.map(item => ({
      key: item.key,
      titulo: item.titulo,
      descripcion: item.descripcion,
      precio: Number(item.precio ?? 0),
      cantidad: Number(item.cantidad ?? 1),
      notas: (item.notas ?? '').toString(),
      horas: item.horas ?? null,
      staff: item.staff ?? null,
      fotosImpresas: item.fotosImpresas ?? null,
      trailerMin: item.trailerMin ?? null,
      filmMin: item.filmMin ?? null,
      servicioId: item.servicioId ?? null,
      eventoServicioId: item.eventoServicioId ?? null
    }));
    return JSON.stringify({
      formRaw,
      programacionRaw,
      paquetes,
      serviciosFechasSeleccionadas: this.serviciosFechasSeleccionadas,
      selectedEventoId: this.selectedEventoId ?? null,
      selectedServicioId: this.selectedServicioId ?? null
    });
  }

  private populateProgramacion(eventos: ProgramacionEventoItemConfig[]): void {
    const array = this.programacion;
    this.clearFormArray(array);

    const configs: ProgramacionEventoItem[] = eventos.map((config, index) => ({
      ...config,
      esPrincipal: config.esPrincipal ?? index < this.programacionMinimaRecomendada
    })).filter(config => this.hasProgramacionContent(config));

    configs.forEach(config => {
      array.push(this.createProgramacionItem(config));
    });

    this.ensureProgramacionPrincipales();
    this.syncProgramacionFechas(this.form.get('fechaEvento')?.value ?? this.fechaEventoOriginal);
  }

  private ensureProgramacionPrincipales(): void {
    this.programacion.controls.forEach((control, index) => {
      const grupo = control as UntypedFormGroup;
      const objetivo = index < this.programacionMinimaRecomendada;
      if (grupo.get('esPrincipal')?.value !== objetivo) {
        grupo.get('esPrincipal')?.setValue(objetivo, { emitEvent: false });
      }
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

  private showAlertHtml(icon: AlertIcon, title: string, html: string): void {
    void Swal.fire({
      icon,
      title,
      html,
      confirmButtonText: 'Entendido'
    });
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

  private validarRestriccionesProgramacion(diasNumero: number | null): string[] {
    const errores: string[] = [];
    const fechasTrabajo = this.fechasTrabajoValores;
    const diasEsperados = diasNumero != null && diasNumero >= 1 ? Math.min(Math.floor(diasNumero), 7) : 0;

    if (diasEsperados > 0 && fechasTrabajo.length !== diasEsperados) {
      errores.push(`Debes registrar ${diasEsperados} fecha(s) de trabajo.`);
      return errores;
    }

    const fechasUnicas = new Set(fechasTrabajo);
    if (fechasUnicas.size !== fechasTrabajo.length) {
      errores.push('Las fechas de trabajo no pueden repetirse.');
    }

    const ordenadas = [...fechasTrabajo].sort();
    const desordenadas = fechasTrabajo.some((fecha, index) => fecha !== ordenadas[index]);
    if (desordenadas) {
      errores.push('Ordena las fechas de trabajo cronológicamente (de la más próxima a la más lejana).');
    }

    for (const fecha of fechasTrabajo) {
      const indices = this.getProgramacionIndicesPorFecha(fecha);
      const fechaLabel = this.formatFechaConDia(fecha);

      if (!indices.length) {
        errores.push(`"${fechaLabel}": agrega al menos una locación.`);
        continue;
      }

      const locacionKeyConteo = new Map<string, number>();
      let incompletas = 0;

      indices.forEach(index => {
        const grupo = this.programacion.at(index) as UntypedFormGroup | null;
        const raw = grupo?.getRawValue() as Record<string, unknown> | undefined;
        const nombre = (raw?.['nombre'] ?? '').toString().trim();
        const direccion = (raw?.['direccion'] ?? '').toString().trim();
        const hora = (raw?.['hora'] ?? '').toString().trim();
        if (!nombre || !direccion || !hora) {
          incompletas += 1;
        }
        if (nombre && direccion && hora) {
          const key = `${this.normalizarClave(nombre)}|${this.normalizarClave(direccion)}|${hora}`;
          locacionKeyConteo.set(key, (locacionKeyConteo.get(key) ?? 0) + 1);
        }
      });

      if (incompletas > 0) {
        errores.push(`"${fechaLabel}": tienes ${incompletas} locación(es) con datos incompletos.`);
      }

      const duplicadas = Array.from(locacionKeyConteo.values()).some(total => total > 1);
      if (duplicadas) {
        errores.push(`"${fechaLabel}": hay locaciones duplicadas (misma locación, dirección y hora).`);
      }
    }

    return errores;
  }

  private extractProgramacionEventos(cotizacion: Cotizacion, raw?: CotizacionPayload | null): ProgramacionEventoItem[] {
    const rawRecord = this.asRecord(raw);
    const cotizacionRecord = this.asRecord(cotizacion);
    const cotizacionRawRecord = this.asRecord(cotizacion.raw);
    const detalleRecord = this.asRecord(rawRecord['cotizacion']);
    const candidates: unknown[] = [
      detalleRecord['eventos'],
      rawRecord['eventos'],
      cotizacionRecord['eventos'],
      cotizacionRawRecord['eventos']
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) {
        return candidate
          .map((evento: AnyRecord, index: number) => this.mapEventoToConfig(evento, index))
          .filter(config => this.hasProgramacionContent(config));
      }
    }

    return [];
  }

  private mapEventoToConfig(evento: AnyRecord, index: number): ProgramacionEventoItem {
    if (!evento) {
      return { esPrincipal: index < this.programacionMinimaRecomendada };
    }

    const nombre = this.pickFirstString(
      evento.ubicacion,
      evento.nombre,
      evento.locacion,
      evento.lugar,
      evento.titulo,
      evento.descripcion
    );

    const direccion = this.pickFirstString(
      evento.direccion,
      evento.direccionExacta,
      evento.address
    );

    const fecha = this.normalizeProgramacionFecha(
      this.pickFirstString(
        evento.fecha,
        evento.fechaEvento,
        evento.Fecha,
        evento.date
      )
    );

    const hora = this.normalizeProgramacionHora(
      this.pickFirstString(
        evento.hora,
        evento.horaEvento,
        evento.Hora,
        evento.time
      )
    );

    const notas = this.pickFirstString(
      evento.notas,
      evento.comentarios,
      evento.observaciones,
      evento.descripcion
    );

    const esPrincipal = Boolean(
      evento.esPrincipal ??
      evento.principal ??
      (index < this.programacionMinimaRecomendada)
    );

    return {
      nombre: nombre || undefined,
      direccion: direccion || undefined,
      fecha,
      hora,
      notas: notas || undefined,
      esPrincipal
    };
  }

  private createProgramacionItem(config: ProgramacionEventoItem): UntypedFormGroup {
    const hora24 = this.normalizeHora24(config.hora ?? '');
    const horaParts = this.splitHoraTo12(hora24);
    const grupo = this.fb.group({
      nombre: [config.nombre ?? '', Validators.required],
      direccion: [config.direccion ?? '', Validators.required],
      fecha: [{ value: config.fecha ?? '', disabled: true }],
      hora: [hora24, [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/), this.horaRangoValidator()]],
      hora12: [horaParts.hora12, Validators.required],
      minuto: [horaParts.minuto, Validators.required],
      ampm: [horaParts.ampm, Validators.required],
      notas: [config.notas ?? ''],
      esPrincipal: [config.esPrincipal ?? false]
    });
    this.bindHoraControls(grupo);
    this.bindFechaControl(grupo);
    return grupo;
  }

  private bindHoraControls(grupo: UntypedFormGroup): void {
    const updateHora = () => {
      const hora12 = grupo.get('hora12')?.value;
      const minuto = grupo.get('minuto')?.value;
      const ampm = grupo.get('ampm')?.value;
      const hora24 = this.toHora24(hora12, minuto, ampm);
      grupo.get('hora')?.setValue(hora24, { emitEvent: false });
    };

    ['hora12', 'minuto', 'ampm'].forEach(controlName => {
      grupo.get(controlName)?.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(updateHora);
    });

    updateHora();
  }

  private bindFechaControl(grupo: UntypedFormGroup): void {
    const fechaControl = grupo.get('fecha');
    if (!fechaControl) {
      return;
    }
    let lastValid = fechaControl.value;
    fechaControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (!this.isMultipleDias()) {
          lastValid = value;
          return;
        }
        const maxDias = this.parseNumber(this.form.get('dias')?.value);
        if (maxDias == null || maxDias < 1) {
          lastValid = value;
          return;
        }
        const fecha = (value ?? '').toString().trim();
        if (!fecha) {
          lastValid = value;
          return;
        }
        const fechasUnicas = this.getFechasProgramacionUnicas();
        if (fechasUnicas.length <= maxDias) {
          const fechaAnterior = (lastValid ?? '').toString().trim();
          if (fechaAnterior && fechaAnterior !== fecha && this.serviciosFechasSeleccionadas.length) {
            const fechasActuales = this.getFechasProgramacionUnicas();
            if (!fechasActuales.includes(fechaAnterior)) {
              this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.map(entry =>
                entry.fecha === fechaAnterior ? { ...entry, fecha } : entry
              );
            }
          }
          lastValid = value;
          return;
        }
        const fechaAnterior = (lastValid ?? '').toString().trim();
        const fechasPermitidas = fechasUnicas.filter(item => item !== fecha);
        const fechasTexto = fechasPermitidas.slice(0, maxDias);
        if (!fechaAnterior) {
          fechaControl.setValue(lastValid ?? '', { emitEvent: false });
          void Swal.fire({
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
        void Swal.fire({
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
            fechaControl.setValue(lastValid ?? '', { emitEvent: false });
            return;
          }
          this.programacion.controls.forEach(control => {
            const controlFecha = (control as UntypedFormGroup).get('fecha');
            if (controlFecha?.value === fechaAnterior) {
              controlFecha.setValue(fecha, { emitEvent: false });
            }
          });
          if (this.serviciosFechasSeleccionadas.length) {
            this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.map(entry =>
              entry.fecha === fechaAnterior ? { ...entry, fecha } : entry
            );
          }
          lastValid = fecha;
        });
      });
  }

  private normalizeHora24(value: string): string {
    const texto = value.toString().trim();
    const match = /^(\d{1,2}):(\d{2})/.exec(texto);
    if (!match) {
      return '';
    }
    const horas = Number(match[1]);
    const minutos = match[2];
    if (!Number.isFinite(horas)) {
      return '';
    }
    return `${String(horas).padStart(2, '0')}:${minutos}`;
  }

  private splitHoraTo12(value: string): { hora12: number | null; minuto: string | null; ampm: 'AM' | 'PM' | null } {
    const texto = this.normalizeHora24(value);
    const match = /^(\d{2}):(\d{2})$/.exec(texto);
    if (!match) {
      return { hora12: null, minuto: null, ampm: null };
    }
    let horas = Number(match[1]);
    const minutos = match[2];
    const ampm = horas >= 12 ? 'PM' : 'AM';
    horas = horas % 12;
    if (horas === 0) {
      horas = 12;
    }
    return { hora12: horas, minuto: minutos, ampm };
  }

  private toHora24(hora12Value: unknown, minutoValue: unknown, ampmValue: unknown): string {
    const hora12 = Number(hora12Value);
    const minuto = typeof minutoValue === 'string' ? minutoValue : `${minutoValue ?? ''}`;
    const ampm = ampmValue === 'PM' || ampmValue === 'AM' ? ampmValue : '';
    if (!Number.isFinite(hora12) || hora12 < 1 || hora12 > 12 || minuto.length !== 2 || !ampm) {
      return '';
    }
    let horas24 = hora12 % 12;
    if (ampm === 'PM') {
      horas24 += 12;
    }
    return `${String(horas24).padStart(2, '0')}:${minuto}`;
  }

  private horaRangoValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim();
      if (!value) {
        return null;
      }
      const match = /^(\d{2}):(\d{2})$/.exec(value);
      if (!match) {
        return null;
      }
      const horas = Number(match[1]);
      const minutos = Number(match[2]);
      if (!Number.isFinite(horas) || !Number.isFinite(minutos)) {
        return null;
      }
      const total = horas * 60 + minutos;
      const min = 6 * 60;
      const max = 22 * 60;
      return total < min || total > max ? { rangoHora: true } : null;
    };
  }

  private hasProgramacionContent(config: ProgramacionEventoItemConfig): boolean {
    return Boolean(
      (config.nombre && config.nombre.trim()) ||
      (config.direccion && config.direccion.trim()) ||
      (config.fecha && config.fecha.trim()) ||
      (config.hora && config.hora.trim()) ||
      (config.notas && config.notas.trim())
    );
  }

  private syncProgramacionFechas(fecha?: string | null): void {
    const referencia = this.normalizeProgramacionFecha(
      fecha ??
      this.form.get('fechaEvento')?.value ??
      this.fechaEventoOriginal
    ) ?? '';
    this.programacion.controls.forEach(control => {
      const grupo = control as UntypedFormGroup;
      const fechaControl = grupo.get('fecha');
      if (!fechaControl) {
        return;
      }
      const actual = (fechaControl.value ?? '').toString().trim();
      if (!actual && referencia) {
        fechaControl.setValue(referencia, { emitEvent: false });
      }
      if (!fechaControl.disabled) {
        fechaControl.disable({ emitEvent: false });
      }
    });
  }

  isMultipleDias(): boolean {
    const value = this.form.get('dias')?.value;
    const parsed = this.parseNumber(value);
    return parsed != null && parsed > 1;
  }

  getCantidadMaximaPorDias(): number | null {
    const parsed = this.parseNumber(this.form.get('dias')?.value);
    return parsed != null && parsed >= 1 ? parsed : null;
  }

  getCantidadOptions(): number[] {
    const max = this.getCantidadMaximaPorDias();
    const limite = max != null && max >= 1 ? max : 1;
    return Array.from({ length: limite }, (_, index) => index + 1);
  }

  private getFechasProgramacionUnicas(): string[] {
    const fechas = this.programacion.controls
      .map(control => (control as UntypedFormGroup).get('fecha')?.value)
      .map(value => (value ?? '').toString().trim())
      .filter(Boolean);
    return Array.from(new Set(fechas)).sort();
  }

  getProgramacionIndicesPorFecha(fecha: string): number[] {
    const objetivo = (fecha ?? '').toString().trim();
    if (!objetivo) {
      return [];
    }
    const indices = Array.from({ length: this.programacion.length }, (_, index) => index).filter(index => {
      const grupo = this.programacion.at(index) as UntypedFormGroup | null;
      const fechaLocacion = (grupo?.get('fecha')?.value ?? '').toString().trim();
      return fechaLocacion === objetivo;
    });
    indices.sort((a, b) => {
      const aGrupo = this.programacion.at(a) as UntypedFormGroup | null;
      const bGrupo = this.programacion.at(b) as UntypedFormGroup | null;
      const aHora = ((aGrupo?.getRawValue() as Record<string, unknown> | undefined)?.['hora'] ?? '').toString().trim();
      const bHora = ((bGrupo?.getRawValue() as Record<string, unknown> | undefined)?.['hora'] ?? '').toString().trim();
      const aMin = this.horaToMinutos(aHora);
      const bMin = this.horaToMinutos(bHora);
      if (aMin !== bMin) {
        return aMin - bMin;
      }
      return a - b;
    });
    return indices;
  }

  isProgramacionExpandida(index: number): boolean {
    const grupo = this.programacion.at(index) as UntypedFormGroup | null;
    if (!grupo) {
      return false;
    }
    return this.programacionExpandida.get(grupo) ?? false;
  }

  toggleProgramacionExpandida(index: number): void {
    const grupo = this.programacion.at(index) as UntypedFormGroup | null;
    if (!grupo) {
      return;
    }
    this.setProgramacionExpandida(grupo, !this.isProgramacionExpandida(index));
  }

  getProgramacionHoraResumen(index: number): string {
    const grupo = this.programacion.at(index) as UntypedFormGroup | null;
    const hora = (grupo?.get('hora')?.value ?? '').toString().trim();
    return hora ? this.formatHoraTexto(hora) : 'Sin hora';
  }

  getProgramacionDireccionResumen(index: number): string {
    const grupo = this.programacion.at(index) as UntypedFormGroup | null;
    const direccion = (grupo?.get('direccion')?.value ?? '').toString().trim();
    if (!direccion) {
      return 'Sin dirección';
    }
    return direccion.length > 52 ? `${direccion.slice(0, 52)}...` : direccion;
  }

  isProgramacionIncompleta(index: number): boolean {
    const grupo = this.programacion.at(index) as UntypedFormGroup | null;
    if (!grupo) {
      return true;
    }
    const raw = grupo.getRawValue() as Record<string, unknown>;
    const nombre = (raw['nombre'] ?? '').toString().trim();
    const direccion = (raw['direccion'] ?? '').toString().trim();
    const hora = (raw['hora'] ?? '').toString().trim();
    return !nombre || !direccion || !hora;
  }

  getProgramacionEstadoLabel(index: number): string {
    return this.isProgramacionIncompleta(index) ? 'Incompleta' : 'Completa';
  }

  getProgramacionEstadoClass(index: number): string {
    return this.isProgramacionIncompleta(index) ? 'programacion-status--warn' : 'programacion-status--ok';
  }

  canAgregarLocacion(fecha: string): boolean {
    return this.getProgramacionIndicesPorFecha(fecha).length < this.maxLocacionesPorDia;
  }

  getResumenDia(fecha: string): { total: number; primera: string } {
    const indices = this.getProgramacionIndicesPorFecha(fecha);
    const total = indices.length;
    const primeraHora = indices
      .map(index => ((this.programacion.at(index) as UntypedFormGroup | null)?.get('hora')?.value ?? '').toString().trim())
      .filter(Boolean)
      .sort()[0] ?? '';
    return {
      total,
      primera: primeraHora ? this.formatHoraTexto(primeraHora) : 'Sin hora'
    };
  }

  canCopiarDiaAnterior(diaIndex: number): boolean {
    return diaIndex > 0;
  }

  copiarLocacionesDiaAnterior(diaIndex: number, fechaDestino: string): void {
    if (diaIndex <= 0) {
      return;
    }
    const fechaOrigen = (this.fechasTrabajoValores[diaIndex - 1] ?? '').toString().trim();
    const destino = (fechaDestino ?? '').toString().trim();
    if (!fechaOrigen || !destino || fechaOrigen === destino) {
      return;
    }
    const indicesOrigen = this.getProgramacionIndicesPorFecha(fechaOrigen);
    if (!indicesOrigen.length) {
      this.showAlert('info', 'Sin locaciones', 'El día anterior no tiene locaciones para copiar.');
      return;
    }
    const disponibles = Math.max(0, this.maxLocacionesPorDia - this.getProgramacionIndicesPorFecha(destino).length);
    if (!disponibles) {
      this.showAlert('warning', 'Límite alcanzado', `Máximo ${this.maxLocacionesPorDia} locaciones por día.`);
      return;
    }
    const aCopiar = indicesOrigen.slice(0, disponibles);
    aCopiar.forEach(index => {
      const grupo = this.programacion.at(index) as UntypedFormGroup | null;
      const raw = grupo?.getRawValue() as Record<string, unknown> | undefined;
      this.programacion.push(this.createProgramacionItem({
        nombre: (raw?.['nombre'] ?? '').toString().trim(),
        direccion: (raw?.['direccion'] ?? '').toString().trim(),
        hora: (raw?.['hora'] ?? '').toString().trim(),
        notas: (raw?.['notas'] ?? '').toString().trim(),
        fecha: destino,
        esPrincipal: false
      }));
    });
    this.ensureProgramacionPrincipales();
    this.syncProgramacionFechas();
  }

  onFechaTrabajoChange(index: number, value: unknown): void {
    if (index < 0 || index >= this.fechasTrabajo.length) {
      return;
    }
    const prev = [...this.fechasTrabajoSnapshot];
    const fechaAnterior = (prev[index] ?? '').toString().trim();
    const fecha = (value ?? '').toString().trim();
    const control = this.fechasTrabajo.at(index);
    const duplicada = this.fechasTrabajo.controls.some((ctrl, i) =>
      i !== index && (ctrl.value ?? '').toString().trim() === fecha && !!fecha
    );
    if (duplicada) {
      control.setValue(prev[index] ?? '', { emitEvent: false });
      this.showAlert('warning', 'Fecha repetida', 'Cada día de trabajo debe tener una fecha diferente.');
      return;
    }
    const changingExistingDate = !!fechaAnterior && fechaAnterior !== fecha;
    if (!changingExistingDate) {
      control.setValue(fecha, { emitEvent: false });
      this.ordenarFechasTrabajo();
      this.fechasTrabajoSnapshot = this.getFechasTrabajoRaw();
      this.syncFechaEventoDesdeFechasTrabajo();
      return;
    }
    if (!this.hasLocacionesRegistradas()) {
      control.setValue(fecha, { emitEvent: false });
      this.remapFechaLocacionesYAsignaciones(fechaAnterior, fecha);
      this.ordenarFechasTrabajo();
      this.fechasTrabajoSnapshot = this.getFechasTrabajoRaw();
      this.syncFechaEventoDesdeFechasTrabajo();
      return;
    }
    void Swal.fire({
      icon: 'warning',
      title: 'Cambiar fecha de trabajo',
      html: `
        <p>Ya tienes locaciones registradas.</p>
        <p class="mb-0">¿Seguro que deseas cambiar <b>${this.formatFechaConDia(fechaAnterior)}</b> por <b>${this.formatFechaConDia(fecha)}</b>?</p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) {
        control.setValue(fechaAnterior, { emitEvent: false });
        return;
      }
      control.setValue(fecha, { emitEvent: false });
      this.remapFechaLocacionesYAsignaciones(fechaAnterior, fecha);
      this.ordenarFechasTrabajo();
      this.fechasTrabajoSnapshot = this.getFechasTrabajoRaw();
      this.syncFechaEventoDesdeFechasTrabajo();
    });
  }

  private getFechaProgramacionNuevaFila(fechaForzada?: string): string {
    const forzada = (fechaForzada ?? '').toString().trim();
    if (forzada) {
      return forzada;
    }
    const fechasTrabajo = this.fechasTrabajoValores;
    if (fechasTrabajo.length) {
      return fechasTrabajo[0];
    }
    const fechaEvento = (this.form.get('fechaEvento')?.value ?? '').toString().trim();
    return fechaEvento || this.fechaMinimaEvento;
  }

  private getFechasTrabajoRaw(): string[] {
    return this.fechasTrabajo.controls.map(control => (control.value ?? '').toString().trim());
  }

  private ordenarFechasTrabajo(): void {
    const raw = this.getFechasTrabajoRaw();
    const filled = raw.filter(Boolean).sort();
    const emptyCount = raw.length - filled.length;
    const next = [...filled, ...Array.from({ length: emptyCount }, () => '')];
    this.fechasTrabajo.controls.forEach((ctrl, idx) => {
      ctrl.setValue(next[idx] ?? '', { emitEvent: false });
    });
  }

  private setFechasTrabajoRaw(values: string[]): void {
    this.fechasTrabajo.controls.forEach((control, index) => {
      control.setValue((values[index] ?? '').toString().trim(), { emitEvent: false });
    });
    this.fechasTrabajoSnapshot = this.getFechasTrabajoRaw();
    this.syncFechaEventoDesdeFechasTrabajo();
  }

  private moverDiasAlFinal(indices: number[]): void {
    const values = this.getFechasTrabajoRaw();
    const validos = Array.from(new Set(indices))
      .filter(index => Number.isInteger(index) && index >= 0 && index < values.length)
      .sort((a, b) => a - b);
    if (!validos.length) {
      return;
    }
    const removidos = validos.map(index => values[index] ?? '');
    const restantes = values.filter((_, index) => !validos.includes(index));
    this.setFechasTrabajoRaw([...restantes, ...removidos]);
  }



  private async seleccionarDiasAEliminar(anterior: number, nuevo: number): Promise<number[] | null> {
    const values = this.getFechasTrabajoRaw();
    const cantidadAEliminar = anterior - nuevo;
    if (cantidadAEliminar <= 0 || values.length <= nuevo) {
      return [];
    }
    const opcionesHtml = values.map((fecha, index) => {
      const fechaLabel = fecha ? this.formatFechaConDia(fecha) : 'Sin fecha';
      const locaciones = fecha ? this.getProgramacionIndicesPorFecha(fecha).length : 0;
      const checked = index >= nuevo ? 'checked' : '';
      const estado = locaciones > 0 ? `${locaciones} locaciones` : 'Sin locaciones';
      return `
        <label class="d-flex align-items-center gap-2 mb-2 p-2 border rounded">
          <input type="checkbox" class="swal2-day-checkbox" value="${index}" ${checked}>
          <span><b>Dia ${index + 1}</b> - ${fechaLabel}<br><small class="text-muted">${estado}</small></span>
        </label>
      `;
    }).join('');
    const result = await Swal.fire({
      icon: 'question',
      title: 'Elige los dias a eliminar',
      width: 760,
      html: `
        <p class="mb-2">Estas reduciendo de <b>${anterior}</b> a <b>${nuevo}</b> dias.</p>
        <p class="mb-2">Selecciona <b>${cantidadAEliminar}</b> dia(s) para eliminar.</p>
        <div class="text-start" style="max-height:320px;overflow:auto;">${opcionesHtml}</div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Eliminar seleccionados',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const selected = Array.from(document.querySelectorAll<HTMLInputElement>('.swal2-day-checkbox:checked'))
          .map(node => Number(node.value))
          .filter(Number.isFinite);
        if (selected.length !== cantidadAEliminar) {
          Swal.showValidationMessage(`Selecciona exactamente ${cantidadAEliminar} dia(s).`);
          return null;
        }
        return selected;
      }
    });
    return result.isConfirmed ? ((result.value as number[] | null) ?? []) : null;
  }


  private syncFechaEventoDesdeFechasTrabajo(): void {
    const primera = this.fechasTrabajoValores[0] ?? '';
    this.form.get('fechaEvento')?.setValue(primera || null, { emitEvent: false });
  }

  private hasLocacionesRegistradas(): boolean {
    return this.programacion.controls.some(control => {
      const raw = (control as UntypedFormGroup).getRawValue() as Record<string, unknown>;
      const nombre = (raw['nombre'] ?? '').toString().trim();
      const direccion = (raw['direccion'] ?? '').toString().trim();
      const hora = (raw['hora'] ?? '').toString().trim();
      const notas = (raw['notas'] ?? '').toString().trim();
      return !!(nombre || direccion || hora || notas);
    });
  }

  private remapFechaLocacionesYAsignaciones(fechaAnterior: string, fechaNueva: string): void {
    if (!fechaAnterior || !fechaNueva || fechaAnterior === fechaNueva) {
      return;
    }
    this.programacion.controls.forEach(control => {
      const fechaControl = (control as UntypedFormGroup).get('fecha');
      if ((fechaControl?.value ?? '').toString().trim() === fechaAnterior) {
        fechaControl?.setValue(fechaNueva, { emitEvent: false });
      }
    });
    if (this.serviciosFechasSeleccionadas.length) {
      this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.map(entry =>
        entry.fecha === fechaAnterior ? { ...entry, fecha: fechaNueva } : entry
      );
    }
  }


  formatFechaConDia(fecha: string): string {
    const parsed = parseDateInput(fecha);
    if (!parsed) {
      return fecha;
    }
    const base = new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(parsed);
    return base.replace(/ de (\d{4})$/, ' del $1');
  }

  private normalizeDias(value: unknown): number {
    const parsed = this.parseNumber(value);
    if (parsed == null || parsed < 1) {
      return 0;
    }
    return Math.min(Math.floor(parsed), 7);
  }

  private onDiasChange(value: unknown): void {
    if (this.diasChangeGuard) {
      return;
    }
    const diasControl = this.form.get('dias');
    const nuevo = this.normalizeDias(value);
    const anterior = this.lastDiasAplicado > 0 ? this.lastDiasAplicado : this.fechasTrabajo.length;
    const valorControl = this.parseNumber(diasControl?.value);

    if (diasControl && valorControl !== nuevo) {
      this.diasChangeGuard = true;
      diasControl.setValue(nuevo || null, { emitEvent: false });
      diasControl.updateValueAndValidity({ emitEvent: false });
      this.diasChangeGuard = false;
    }

    if (anterior > 0 && nuevo > 0 && nuevo < anterior) {
      void (async () => {
        const fechasOriginales = this.getFechasTrabajoRaw();
        const indices = await this.seleccionarDiasAEliminar(anterior, nuevo);
        if (indices == null) {
          this.setFechasTrabajoRaw(fechasOriginales);
          this.diasChangeGuard = true;
          diasControl?.setValue(anterior || null, { emitEvent: false });
          diasControl?.updateValueAndValidity({ emitEvent: false });
          this.diasChangeGuard = false;
          this.applyDiasRules(anterior);
          this.lastDiasAplicado = anterior;
          return;
        }
        this.moverDiasAlFinal(indices);
        this.aplicarReduccionDias(nuevo);
        this.applyDiasRules(nuevo);
        this.lastDiasAplicado = nuevo;
      })();
      return;
    }

    this.applyDiasRules(nuevo);
    this.lastDiasAplicado = nuevo;
  }

  private getImpactoReduccionDias(nuevoDias: number): { total: number; fechas: number; locaciones: number; asignaciones: number } {
    const fechasActuales = this.getFechasTrabajoRaw();
    const fechasPermitidas = new Set(fechasActuales.slice(0, nuevoDias).filter(Boolean));
    const fechasEliminadas = fechasActuales.slice(nuevoDias).filter(Boolean);
    const locacionesEliminadas = this.programacion.controls.filter(control => {
      const fecha = ((control as UntypedFormGroup).get('fecha')?.value ?? '').toString().trim();
      return !!fecha && !fechasPermitidas.has(fecha);
    }).length;
    const asignacionesEliminadas = this.serviciosFechasSeleccionadas.filter(entry =>
      !fechasPermitidas.has((entry.fecha ?? '').toString().trim())
    ).length;
    const total = fechasEliminadas.length + locacionesEliminadas + asignacionesEliminadas;
    return { total, fechas: fechasEliminadas.length, locaciones: locacionesEliminadas, asignaciones: asignacionesEliminadas };
  }

  private aplicarReduccionDias(nuevoDias: number): void {
    const fechasActuales = this.getFechasTrabajoRaw();
    const fechasPermitidas = new Set(fechasActuales.slice(0, nuevoDias).filter(Boolean));
    for (let i = this.programacion.length - 1; i >= 0; i -= 1) {
      const grupo = this.programacion.at(i) as UntypedFormGroup;
      const fecha = (grupo.get('fecha')?.value ?? '').toString().trim();
      if (fecha && !fechasPermitidas.has(fecha)) {
        this.programacion.removeAt(i);
      }
    }
    this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry =>
      fechasPermitidas.has((entry.fecha ?? '').toString().trim())
    );
  }

  private syncFechasTrabajoPorDias(value: unknown): void {
    const dias = this.parseNumber(value);
    const target = dias != null && dias >= 1 ? Math.min(Math.floor(dias), 7) : 0;
    const prev = [...this.fechasTrabajoSnapshot];
    const currentLength = this.fechasTrabajo.length;
    const prevLength = prev.length;
    while (this.fechasTrabajo.length < target) {
      this.fechasTrabajo.push(this.fb.control('', [Validators.required, this.fechaEventoEnRangoValidator()]));
    }
    while (this.fechasTrabajo.length > target) {
      this.fechasTrabajo.removeAt(this.fechasTrabajo.length - 1);
    }
    this.fechasTrabajo.controls.forEach(control => {
      control.setValidators([Validators.required, this.fechaEventoEnRangoValidator()]);
      control.updateValueAndValidity({ emitEvent: false });
    });
    if (currentLength === 0 && prev.some(Boolean)) {
      this.fechasTrabajo.controls.forEach((control, index) => {
        const seed = (prev[index] ?? '').toString().trim();
        if (seed) {
          control.setValue(seed, { emitEvent: false });
        }
      });
    }
    const next = this.getFechasTrabajoRaw();
    const isExpansion = target > prevLength;
    if (!isExpansion) {
      this.remapProgramacionFechas(prev, next);
    }
    this.fechasTrabajoSnapshot = next;
    this.syncFechaEventoDesdeFechasTrabajo();
  }

  private remapProgramacionFechas(prev: string[], next: string[]): void {
    const nextNoVacias = next.map(item => item.trim()).filter(Boolean);
    if (!nextNoVacias.length) {
      this.programacion.controls.forEach(control => {
        (control as UntypedFormGroup).get('fecha')?.setValue('', { emitEvent: false });
      });
      return;
    }
    const max = Math.max(prev.length, next.length);
    for (let i = 0; i < max; i += 1) {
      const oldFecha = (prev[i] ?? '').trim();
      const newFecha = (next[i] ?? '').trim();
      if (!oldFecha || !newFecha || oldFecha === newFecha) {
        continue;
      }
      this.programacion.controls.forEach(control => {
        const fechaControl = (control as UntypedFormGroup).get('fecha');
        if ((fechaControl?.value ?? '').toString().trim() === oldFecha) {
          fechaControl?.setValue(newFecha, { emitEvent: false });
        }
      });
    }
    const fallback = nextNoVacias[0];
    this.programacion.controls.forEach(control => {
      const fechaControl = (control as UntypedFormGroup).get('fecha');
      const fechaActual = (fechaControl?.value ?? '').toString().trim();
      if (!fechaActual || !nextNoVacias.includes(fechaActual)) {
        fechaControl?.setValue(fallback, { emitEvent: false });
      }
    });
  }

  private applyDiasRules(value: unknown): void {
    const parsedRaw = this.parseNumber(value);
    const parsed = parsedRaw != null && parsedRaw >= 1 ? Math.min(Math.floor(parsedRaw), 7) : parsedRaw;
    const diasControl = this.form.get('dias');
    if (parsed !== parsedRaw && diasControl) {
      diasControl.setValue(parsed, { emitEvent: false });
      diasControl.updateValueAndValidity({ emitEvent: false });
    }
    const multiple = parsed != null && parsed > 1;
    const fechaControl = this.form.get('fechaEvento');
    const horasControl = this.form.get('horasEstimadas');
    if (fechaControl) {
      fechaControl.clearValidators();
      fechaControl.updateValueAndValidity({ emitEvent: false });
    }
    this.syncFechasTrabajoPorDias(parsed);
    if (horasControl) {
      const diasValidos = parsed != null && parsed >= 1;
      if (diasValidos && horasControl.disabled) {
        horasControl.enable({ emitEvent: false });
      }
      if (!diasValidos && horasControl.enabled) {
        horasControl.reset('', { emitEvent: false });
        horasControl.disable({ emitEvent: false });
      }
      horasControl.updateValueAndValidity({ emitEvent: false });
    }
    this.programacion.controls.forEach(control => {
      const grupo = control as UntypedFormGroup;
      const fechaProg = grupo.get('fecha');
      if (!fechaProg) return;
      fechaProg.clearValidators();
      if (!fechaProg.disabled) {
        fechaProg.disable({ emitEvent: false });
      }
      fechaProg.updateValueAndValidity({ emitEvent: false });
    });
    this.syncProgramacionFechas();

    if (!multiple && this.selectedPaquetes.some(item => (item.cantidad ?? 1) !== 1)) {
      this.selectedPaquetes = this.selectedPaquetes.map(item => ({ ...item, cantidad: 1 }));
      this.syncTotalEstimado();
    }
    if (multiple) {
      const max = this.getCantidadMaximaPorDias();
      if (max != null) {
        const ajustados = this.selectedPaquetes.map(item => ({
          ...item,
          cantidad: Math.min(Number(item.cantidad ?? 1) || 1, max)
        }));
        const changed = ajustados.some((item, index) => item.cantidad !== this.selectedPaquetes[index]?.cantidad);
        if (changed) {
          this.selectedPaquetes = ajustados;
          this.serviciosFechasSeleccionadas = [];
          this.syncTotalEstimado();
        }
      }
    }

    if (!multiple && this.serviciosFechasSeleccionadas.length) {
      this.serviciosFechasSeleccionadas = [];
    }
    if (!multiple && this.asignacionFechasAbierta) {
      this.asignacionFechasAbierta = false;
    }

    this.refreshSelectedPaquetesColumns();
  }

  isDepartamentoLima(): boolean {
    const depto = (this.form.get('departamento')?.value ?? '').toString().trim().toLowerCase();
    return depto === 'lima';
  }

  private applyViaticosRules(): void {
    const viaticosClienteControl = this.form.get('viaticosCliente');
    const montoControl = this.form.get('viaticosMonto');
    if (!viaticosClienteControl || !montoControl) {
      return;
    }
    if (this.isDepartamentoLima()) {
      viaticosClienteControl.setValue(true, { emitEvent: false });
      montoControl.reset(null, { emitEvent: false });
      montoControl.clearValidators();
      if (!montoControl.disabled) {
        montoControl.disable({ emitEvent: false });
      }
      montoControl.updateValueAndValidity({ emitEvent: false });
      return;
    }
    const viaticosCliente = !!viaticosClienteControl.value;
    if (viaticosCliente) {
      montoControl.reset(null, { emitEvent: false });
      montoControl.clearValidators();
      if (!montoControl.disabled) {
        montoControl.disable({ emitEvent: false });
      }
    } else {
      if (montoControl.disabled) {
        montoControl.enable({ emitEvent: false });
      }
      montoControl.setValidators([Validators.required, Validators.min(1)]);
    }
    montoControl.updateValueAndValidity({ emitEvent: false });
    this.syncTotalEstimado();
  }

  private handleViaticosClienteChange(value: unknown): void {
    if (this.viaticosChangeLock) {
      return;
    }
    const prev = this.lastViaticosCliente ?? Boolean(this.form.get('viaticosCliente')?.value);
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
        this.form.get('viaticosCliente')?.setValue(next, { emitEvent: false });
        this.applyViaticosRules();
        this.syncViaticosSnapshot();
        return;
      }
      this.viaticosChangeLock = true;
      this.form.get('viaticosCliente')?.setValue(prev, { emitEvent: false });
      this.applyViaticosRules();
      if (this.lastViaticosMonto != null) {
        this.form.get('viaticosMonto')?.setValue(this.lastViaticosMonto, { emitEvent: false });
      } else {
        this.form.get('viaticosMonto')?.reset(null, { emitEvent: false });
      }
      this.viaticosChangeLock = false;
    });
  }

  onViaticosMontoBlur(value: unknown): void {
    if (this.viaticosChangeLock || Boolean(this.form.get('viaticosCliente')?.value)) {
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
        this.form.get('viaticosMonto')?.setValue(next, { emitEvent: false });
        this.syncViaticosSnapshot();
        this.syncTotalEstimado();
        return;
      }
      this.viaticosChangeLock = true;
      if (prev != null) {
        this.form.get('viaticosMonto')?.setValue(prev, { emitEvent: false });
      } else {
        this.form.get('viaticosMonto')?.reset(null, { emitEvent: false });
      }
      this.viaticosChangeLock = false;
    });
  }

  private syncViaticosSnapshot(): void {
    const viaticosCliente = Boolean(this.form.get('viaticosCliente')?.value);
    const viaticosMonto = this.parseNumber(this.form.get('viaticosMonto')?.value);
    this.lastViaticosCliente = viaticosCliente;
    this.lastViaticosMonto = viaticosMonto != null && viaticosMonto > 0 ? viaticosMonto : null;
  }

  private handleDepartamentoChange(value: unknown): void {
    if (this.departamentoChangeLock) {
      return;
    }
    const next = (value ?? '').toString().trim();
    const prev = (this.lastDepartamento ?? '').toString().trim();
    if (!prev) {
      this.lastDepartamento = next;
      this.applyViaticosRules();
      return;
    }
    if (!next || next === prev) {
      this.lastDepartamento = next;
      this.applyViaticosRules();
      return;
    }
    const monto = this.parseNumber(this.form.get('viaticosMonto')?.value);
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
        this.lastDepartamento = next;
        this.applyViaticosRules();
        this.syncViaticosSnapshot();
        return;
      }
      this.departamentoChangeLock = true;
      this.form.get('departamento')?.setValue(prev, { emitEvent: false });
      this.departamentoChangeLock = false;
    });
  }

  private normalizeProgramacionFecha(valor: unknown): string | undefined {
    if (valor == null) {
      return undefined;
    }
    const raw = String(valor).trim();
    if (!raw) {
      return undefined;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const dash = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dash) {
      return `${dash[3]}-${dash[2]}-${dash[1]}`;
    }
    const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) {
      return `${slash[3]}-${slash[2]}-${slash[1]}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().slice(0, 10);
    }
    return undefined;
  }

  private normalizeProgramacionHora(valor: unknown): string | undefined {
    if (valor == null) {
      return undefined;
    }
    const raw = String(valor).trim();
    if (!raw) {
      return undefined;
    }
    if (/^\d{2}:\d{2}$/.test(raw)) {
      return raw;
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
      return raw.slice(0, 5);
    }
    const match = raw.match(/(\d{2}):(\d{2})/);
    if (match) {
      return `${match[1]}:${match[2]}`;
    }
    return undefined;
  }

  private static computeFechaMinimaEvento(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return EditarCotizacionComponent.formatIsoDate(date);
  }

  private static computeFechaMaximaEvento(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 6);
    return EditarCotizacionComponent.formatIsoDate(date);
  }

  private static formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private fechaEventoEnRangoValidator(): ValidatorFn {
    return control => {
      const raw = control.value;
      if (!raw) {
        return null;
      }
      const date = parseDateInput(raw);
      if (!date) {
        return { fechaEventoInvalida: true };
      }
      const min = parseDateInput(this.fechaMinimaEvento);
      const max = parseDateInput(this.fechaMaximaEvento);
      if (!min || !max) {
        return null;
      }
      if (date < min) {
        return { fechaEventoAnterior: true };
      }
      if (date > max) {
        return { fechaEventoPosterior: true };
      }
      return null;
    };
  }

  private clearFormArray(array: UntypedFormArray): void {
    for (let i = array.length - 1; i >= 0; i--) {
      array.removeAt(i);
    }
  }

  private pickFirstString(...values: unknown[]): string {
    for (const value of values) {
      if (value == null) {
        continue;
      }
      const texto = String(value).trim();
      if (texto) {
        return texto;
      }
    }
    return '';
  }

  private normalizeEventLabel(value: unknown): string {
    const text = String(value ?? '').trim().toLowerCase();
    if (!text) {
      return '';
    }
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private normalizeEventoCatalogo(evento: unknown): EventoCatalogo | null {
    const record = this.asRecord(evento);
    const id = this.parseNumber(
      record['id']
      ?? record['PK_E_Cod']
      ?? record['idEvento']
      ?? record['idTipoEvento']
      ?? record['ID']
    );
    if (id == null || id <= 0) {
      return null;
    }
    const nombre = this.pickFirstString(
      record['nombre'],
      record['E_Nombre'],
      record['name'],
      record['tipoEvento'],
      record['evento']
    ) || 'Evento';
    return { id, nombre, raw: record };
  }

  private applyPendingSelections(): void {
    if (this.pendingServicioId != null) {
      const servicio = this.servicios.find(s => this.getId(s) === this.pendingServicioId);
      if (servicio) {
        this.selectedServicioId = this.pendingServicioId;
        this.selectedServicioNombre = this.getNombre(servicio);
      }
    } else if (!this.selectedServicioId && this.servicios.length && !this.selectedServicioNombre) {
      // Mantiene la lista vacía hasta que se vincule un servicio manualmente
      this.selectedServicioId = null;
      this.selectedServicioNombre = '';
    }

    if (this.pendingEventoId != null) {
      const evento = this.eventos.find(e => e.id === this.pendingEventoId);
      if (evento) {
        const record = this.asRecord(evento);
        const eventoId = this.parseNumber(record['id']) ?? null;
        this.selectedEventoId = eventoId;
        this.selectedEventoNombre = this.getNombre(evento);
        this.selectedEventoIdValue = eventoId != null ? String(eventoId) : '';
      } else if (this.selectedEventoNombre) {
        const byName = this.eventos.find(e =>
          this.normalizeEventLabel(e.nombre) === this.normalizeEventLabel(this.selectedEventoNombre)
        );
        if (byName) {
          this.selectedEventoId = byName.id;
          this.selectedEventoNombre = byName.nombre;
          this.selectedEventoIdValue = String(byName.id);
          this.pendingEventoId = byName.id;
        }
      }
    } else if (!this.selectedEventoId && this.selectedEventoNombre && this.eventos.length) {
      const byName = this.eventos.find(e =>
        this.normalizeEventLabel(e.nombre) === this.normalizeEventLabel(this.selectedEventoNombre)
      );
      if (byName) {
        this.selectedEventoId = byName.id;
        this.selectedEventoNombre = byName.nombre;
        this.selectedEventoIdValue = String(byName.id);
      }
    } else if (!this.selectedEventoId && this.eventos.length && !this.selectedEventoNombre) {
      this.selectedEventoId = null;
      this.selectedEventoIdValue = '';
      this.selectedEventoNombre = '';
    }

    if (this.selectedEventoId != null && this.selectedServicioId != null) {
      this.loadEventosServicio();
    } else {
      this.paquetesRows = [];
      this.loadingPaquetes = false;
    }

    if (this.form.pristine && this.programacion.pristine && !this.saving) {
      this.initialSnapshot = this.buildSnapshot();
    }
  }

  private loadEventosServicio(): void {
    if (this.selectedEventoId == null || this.selectedServicioId == null) {
      this.paquetesRows = [];
      this.loadingPaquetes = false;
      return;
    }

    this.loadingPaquetes = true;
    this.cotizacionService.getEventosServicio(this.selectedEventoId, this.selectedServicioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: paquetes => {
          const activos = Array.isArray(paquetes)
            ? paquetes.filter(item => {
                const record = this.asRecord(item);
                const estado = this.asRecord(record['estado']);
                const estadoNombre = String(estado['nombre'] ?? record['estadoNombre'] ?? '').toLowerCase();
                const estadoId = this.parseNumber(estado['id'] ?? estado['idEstado'] ?? record['estadoId']);
                return estadoNombre !== 'inactivo' && estadoId !== 2;
              })
            : [];
          this.paquetesRows = activos.map(item => this.normalizePaqueteRow(item));
          this.loadingPaquetes = false;
        },
        error: (err) => {
          console.error('[cotizacion] eventos-servicio', err);
          this.paquetesRows = [];
          this.loadingPaquetes = false;
        }
      });
  }

  private normalizeDateForPayload(value: string | Date | null | undefined): string | null {
    return formatIsoDate(value);
  }

  syncTotalEstimado(): void {
    const control = this.form.get('totalEstimado');
    control?.setValue(this.totalSeleccion || control?.value || 0, { emitEvent: false });
    this.refreshSelectedPaquetesColumns();
  }

  getId(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['id']);
  }

  private getPkgKey(el: unknown): string {
    const record = this.asRecord(el);
    const eventoServicioId = this.getEventoServicioId(record);
    if (eventoServicioId != null) {
      return String(eventoServicioId);
    }
    return String(record['id'] ?? `${record['descripcion']}|${record['precio']}`);
  }

  private getEventoServicioId(item: unknown): number | null {
    const record = this.asRecord(item);
    if (!Object.keys(record).length) {
      return null;
    }
    const eventoServicio = this.asRecord(record['eventoServicio']);
    const num = this.parseNumber(record['eventoServicioId'] ?? record['idEventoServicio'] ?? eventoServicio['id'] ?? record['id']);
    return num != null && num > 0 ? num : null;
  }

  private getHoras(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['horas']);
  }

  private getStaff(item: unknown): number | null {
    const record = this.asRecord(item);
    if (record['personal'] != null) {
      return this.parseNumber(record['personal']);
    }
    const staff = this.asRecord(record['staff']);
    const staffTotal = staff['total'];
    return this.parseNumber(staffTotal ?? record['staff']);
  }

  private getFotosImpresas(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['fotosImpresas']);
  }

  private getTrailerMin(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['trailerMin']);
  }

  private getFilmMin(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['filmMin']);
  }

  private normalizePaqueteRow(item: unknown): PaqueteRow {
    const record = this.asRecord(item);
    const precio = this.parseNumber(record['precio']);
    const staff = this.getStaff(record);
    const horas = this.getHoras(record);
    return {
      titulo: this.getTitulo(record),
      descripcion: this.getDescripcion(record),
      precio: precio != null ? precio : null,
      staff: staff != null ? staff : null,
      horas: horas != null ? horas : null,
      raw: record
    };
  }

  private getTitulo(item: unknown): string {
    const record = this.asRecord(item);
    return String(record['titulo'] ?? 'Paquete');
  }

  private getDescripcion(item: unknown): string {
    const record = this.asRecord(item);
    return String(record['descripcion'] ?? this.getTitulo(record));
  }

  private getMoneda(item: unknown): string | undefined {
    const record = this.asRecord(item);
    const raw = record['moneda'];
    return raw ? String(raw).toUpperCase() : undefined;
  }

  private getGrupo(item: unknown): string | null {
    const record = this.asRecord(item);
    const raw = record['grupo'] ?? null;
    return raw != null ? String(raw) : null;
  }

  private getPaqueteServicioId(item: unknown, fallbackToSelected = true): number | null {
    const record = this.asRecord(item);
    if (!Object.keys(record).length) {
      return this.selectedServicioId;
    }
    const servicio = this.asRecord(record['servicio']);
    const parsed = this.parseNumber(servicio['id'] ?? record['servicioId']);
    if (parsed != null) {
      return parsed;
    }
    return fallbackToSelected ? this.selectedServicioId : null;
  }

  private getPaqueteServicioNombre(item: unknown, fallbackToSelected = true): string | undefined {
    const record = this.asRecord(item);
    const servicio = this.asRecord(record['servicio']);
    const baseNombre = servicio['nombre'] ?? record['servicioNombre'];
    if (baseNombre) {
      const texto = String(baseNombre).trim();
      if (texto) return texto;
    }
    return fallbackToSelected ? (this.selectedServicioNombre || undefined) : undefined;
  }

  private getOpcion(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['opcion']);
  }

  private getDescuento(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['descuento'] ?? null);
  }

  private getRecargo(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['recargo'] ?? null);
  }

  private parseHorasToNumber(value: string | null | undefined): number | undefined {
    if (value == null) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const match = trimmed.match(/([\d.,]+)/);
    if (!match?.[1]) {
      return undefined;
    }
    const parsed = Number(match[1].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private horaToMinutos(value: string): number {
    const texto = (value ?? '').toString().trim();
    const match = /^(\d{2}):(\d{2})$/.exec(texto);
    if (!match) {
      return Number.MAX_SAFE_INTEGER;
    }
    const horas = Number(match[1]);
    const minutos = Number(match[2]);
    if (!Number.isFinite(horas) || !Number.isFinite(minutos)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return (horas * 60) + minutos;
  }

  private formatHoraTexto(hora24: string): string {
    const texto = (hora24 ?? '').toString().trim();
    const match = /^(\d{2}):(\d{2})$/.exec(texto);
    if (!match) {
      return 'Sin hora';
    }
    let hora = Number(match[1]);
    const minuto = match[2];
    if (!Number.isFinite(hora)) {
      return 'Sin hora';
    }
    const ampm = hora >= 12 ? 'PM' : 'AM';
    hora = hora % 12;
    if (hora === 0) {
      hora = 12;
    }
    return `${hora}:${minuto} ${ampm}`;
  }

  private normalizarClave(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private setProgramacionExpandida(grupo: UntypedFormGroup, expandida: boolean): void {
    this.programacionExpandida.set(grupo, expandida);
  }

  private expandirProgramacionConErrores(): void {
    this.programacion.controls.forEach(control => {
      const grupo = control as UntypedFormGroup;
      if (grupo.invalid || this.isProgramacionIncompletaPorGrupo(grupo)) {
        this.setProgramacionExpandida(grupo, true);
      }
    });
  }

  private isProgramacionIncompletaPorGrupo(grupo: UntypedFormGroup): boolean {
    const raw = grupo.getRawValue() as Record<string, unknown>;
    const nombre = (raw['nombre'] ?? '').toString().trim();
    const direccion = (raw['direccion'] ?? '').toString().trim();
    const hora = (raw['hora'] ?? '').toString().trim();
    return !nombre || !direccion || !hora;
  }

  private parseNumber(raw: unknown): number | null {
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed === '') {
        return null;
      }
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : null;
    }
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  private focusPrecioInput(key: string | number): void {
    setTimeout(() => {
      const element = document.getElementById(this.getPrecioInputIdFromKey(key)) as HTMLInputElement | null;
      if (element) {
        element.focus();
        element.select();
      }
    });
  }

  private getPrecioInputIdFromKey(key: string | number): string {
    return `precio-input-${key}`;
  }

  private refreshSelectedPaquetesColumns(): void {
    const base: TableColumn<PaqueteSeleccionado>[] = [
      { key: 'titulo', header: 'Título', sortable: false },
      { key: 'precioUnit', header: 'Precio unit.', sortable: false, class: 'text-center', width: '140px' }
    ];

    if (this.isMultipleDias()) {
      base.splice(1, 0, { key: 'cantidad', header: 'Cant.', sortable: false, class: 'text-center', width: '90px' });
    }

    if (this.shouldShowPrecioOriginal()) {
      base.push({ key: 'precioOriginal', header: 'Original', sortable: false, class: 'text-center', width: '140px' });
    }

    base.push(
      { key: 'horas', header: 'Horas', sortable: false, class: 'text-center', width: '100px' },
      { key: 'staff', header: 'Staff', sortable: false, class: 'text-center', width: '110px' },
      { key: 'subtotal', header: 'Subtotal', sortable: false, class: 'text-center', width: '140px' },
      { key: 'notas', header: 'Notas', sortable: false, filterable: false, width: '280px' },
      { key: 'quitar', header: 'Quitar', sortable: false, filterable: false, class: 'text-center', width: '90px' }
    );

    this.selectedPaquetesColumns = base;
  }
}
