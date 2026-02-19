import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  ValidatorFn,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
import {
  ClienteBusquedaResultado,
  CotizacionAdminCreatePayload,
  CotizacionAdminItemPayload,
  CotizacionAdminEventoPayload,
  CotizacionAdminServicioFechaPayload,
  PedidoDisponibilidadDiariaResponse,
} from '../model/cotizacion.model';
import { CotizacionService } from '../service/cotizacion.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { parseDateInput } from '../../../shared/utils/date-utils';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { corregirCumple } from 'src/app/shared/utils/text-utils';

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
  staffDetalle?: string;
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

type EventoCampoTipo =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox';

interface EventoSchemaCampo {
  key: string;
  label: string;
  type: EventoCampoTipo;
  required: boolean;
  active: boolean;
  order: number;
  options: string[];
}

@Component({
  selector: 'app-registrar-cotizacion',
  templateUrl: './registrar-cotizacion.component.html',
  styleUrls: ['./registrar-cotizacion.component.css'],
})
export class RegistrarCotizacionComponent implements OnInit, OnDestroy {
  readonly fechaMinimaEvento =
    RegistrarCotizacionComponent.computeFechaMinimaEvento();
  readonly fechaMaximaEvento =
    RegistrarCotizacionComponent.computeFechaMaximaEvento();
  readonly horaOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly minutoOptions = Array.from({ length: 12 }, (_, index) =>
    String(index * 5).padStart(2, '0'),
  );
  readonly ampmOptions = ['AM', 'PM'] as const;
  readonly maxLocacionesPorDia = 6;
  form: UntypedFormGroup;

  corregirCumple = corregirCumple;
  corregirCumpleSafe(value: unknown): string {
    return corregirCumple(String(value ?? ''));
  }
  servicios: AnyRecord[] = [];
  eventos: AnyRecord[] = [];
  selectedServicioId: number | null = null;
  selectedServicioNombre = '';
  selectedEventoId: number | null = null;
  selectedEventoNombre = '';
  selectedEventoDetalle: AnyRecord | null = null;
  eventoSelectTouched = false;
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
    'Ucayali',
  ];
  readonly programacionMinimaRecomendada = 1;
  clienteSearchControl = new UntypedFormControl('');
  clienteResultados: ClienteBusquedaResultado[] = [];
  clienteSearchLoading = false;
  clienteSearchError = '';
  clienteSeleccionado: ClienteBusquedaResultado | null = null;
  clienteBusquedaTermino = '';

  readonly clienteDisplay = (
    cliente?: ClienteBusquedaResultado | string | null,
  ): string => {
    if (!cliente) {
      return '';
    }
    if (typeof cliente === 'string') {
      return cliente;
    }
    return this.resolveClienteNombre(cliente);
  };

  paquetesColumns: TableColumn<PaqueteRow>[] = [
    { key: 'titulo', header: 'Título', sortable: true, width: '45%' },
    {
      key: 'precio',
      header: 'Precio',
      sortable: true,
      class: 'text-center',
      width: '120px',
    },
    {
      key: 'horas',
      header: 'Horas',
      sortable: true,
      class: 'text-center',
      width: '100px',
    },
    {
      key: 'staff',
      header: 'Staff',
      sortable: true,
      class: 'text-center',
      width: '100px',
    },
    {
      key: 'acciones',
      header: 'Seleccionar',
      sortable: false,
      filterable: false,
      class: 'text-center',
      width: '200px',
    },
  ];
  paquetesRows: PaqueteRow[] = [];
  selectedPaquetes: PaqueteSeleccionado[] = [];
  selectedPaquetesColumns: TableColumn<PaqueteSeleccionado>[] = [];

  loadingCatalogos = false;
  loadingPaquetes = false;
  loading = false;
  detallePaqueteAbierto = false;
  detallePaqueteSeleccionado: PaqueteDetalle | null = null;
  asignacionFechasAbierta = false;
  fechasDisponibles: string[] = [];
  serviciosFechasSeleccionadas: CotizacionAdminServicioFechaPayload[] = [];
  disponibilidadDiariaPorFecha: Record<string, PedidoDisponibilidadDiariaResponse> = {};
  disponibilidadDiariaLoadingPorFecha: Record<string, boolean> = {};
  private fechasTrabajoSnapshot: string[] = [];
  private lastDiasAplicado = 0;
  private diasChangeGuard = false;
  private programacionExpandida = new WeakMap<UntypedFormGroup, boolean>();
  private tmpIdSequence = 0;
  private lastDepartamento = '';
  private departamentoChangeLock = false;

  private readonly destroy$ = new Subject<void>();

  private readonly fb = inject(UntypedFormBuilder);
  private readonly cotizacionService = inject(CotizacionService);
  private readonly router = inject(Router);

  constructor() {
    this.form = this.fb.group({
      clienteNombre: ['', [Validators.required, Validators.minLength(2)]],
      clienteContacto: [
        '',
        [
          Validators.required,
          Validators.minLength(6),
          Validators.pattern(/^[0-9]{6,15}$/),
        ],
      ],
      fechaEvento: [
        RegistrarCotizacionComponent.computeFechaMinimaEvento(),
        [Validators.required, this.fechaEventoEnRangoValidator()],
      ],
      dias: [null, [Validators.required, Validators.min(1), Validators.max(7)]],
      departamento: ['Lima', Validators.required],
      viaticosCliente: [true],
      viaticosMonto: [{ value: null, disabled: true }],
      horasEstimadas: [
        { value: '', disabled: true },
        [Validators.pattern(/^\d+$/), Validators.min(1)],
      ],
      descripcion: [''],
      totalEstimado: [{ value: 0, disabled: true }, Validators.min(0)],
      fechasTrabajo: this.fb.array([]),
      programacion: this.fb.array([]),
      datosEvento: this.fb.group({}),
    });
  }

  ngOnInit(): void {
    this.resetFormState();
    this.loadCatalogos();
    this.initClienteBusqueda();
    this.refreshSelectedPaquetesColumns();
    this.syncProgramacionFechas();
    this.form
      .get('fechaEvento')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((fecha) => this.syncProgramacionFechas(fecha));
    this.form
      .get('dias')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => this.onDiasChange(value));
    this.lastDepartamento = (this.form.get('departamento')?.value ?? '')
      .toString()
      .trim();
    this.form
      .get('departamento')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => this.handleDepartamentoChange(value));
    this.form
      .get('viaticosCliente')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyViaticosRules());
    this.form
      .get('viaticosMonto')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncTotalEstimado());
    this.applyDiasRules(this.form.get('dias')?.value);
    this.lastDiasAplicado = this.normalizeDias(this.form.get('dias')?.value);
    this.applyViaticosRules();
    this.applyEventoGateRules();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resetFormState();
  }

  get programacion(): UntypedFormArray {
    return this.form.get('programacion') as UntypedFormArray;
  }

  get fechasTrabajo(): UntypedFormArray {
    return this.form.get('fechasTrabajo') as UntypedFormArray;
  }

  get datosEventoGroup(): UntypedFormGroup {
    return this.form.get('datosEvento') as UntypedFormGroup;
  }

  get eventoFormSchema(): EventoSchemaCampo[] {
    const record = this.asRecord(this.selectedEventoDetalle);
    const rawSchema = Array.isArray(record['formSchema'])
      ? (record['formSchema'] as unknown[])
      : [];
    return rawSchema
      .map((item, index) => this.normalizeEventoSchemaCampo(item, index))
      .filter((item): item is EventoSchemaCampo => item != null)
      .filter((item) => item.active)
      .sort((a, b) => a.order - b.order);
  }

  get fechasTrabajoValores(): string[] {
    return this.fechasTrabajo.controls
      .map((control) => (control.value ?? '').toString().trim())
      .filter(Boolean);
  }

  getProgramacionIndicesPorFecha(fecha: string): number[] {
    const objetivo = (fecha ?? '').toString().trim();
    if (!objetivo) {
      return [];
    }
    const indices = Array.from(
      { length: this.programacion.length },
      (_, index) => index,
    ).filter((index) => {
      const grupo = this.programacion.at(index) as UntypedFormGroup | null;
      const fechaLocacion = (grupo?.get('fecha')?.value ?? '')
        .toString()
        .trim();
      return fechaLocacion === objetivo;
    });
    indices.sort((a, b) => {
      const aGrupo = this.programacion.at(a) as UntypedFormGroup | null;
      const bGrupo = this.programacion.at(b) as UntypedFormGroup | null;
      const aHora = (
        (aGrupo?.getRawValue() as Record<string, unknown> | undefined)?.[
          'hora'
        ] ?? ''
      )
        .toString()
        .trim();
      const bHora = (
        (bGrupo?.getRawValue() as Record<string, unknown> | undefined)?.[
          'hora'
        ] ?? ''
      )
        .toString()
        .trim();
      const aMin = this.horaToMinutos(aHora);
      const bMin = this.horaToMinutos(bHora);
      if (aMin !== bMin) {
        return aMin - bMin;
      }
      return a - b;
    });
    return indices;
  }

  onFechaTrabajoChange(index: number, value: unknown): void {
    if (index < 0 || index >= this.fechasTrabajo.length) {
      return;
    }
    const prev = [...this.fechasTrabajoSnapshot];
    const fechaAnterior = (prev[index] ?? '').toString().trim();
    const fecha = (value ?? '').toString().trim();
    const control = this.fechasTrabajo.at(index);
    const duplicada = this.fechasTrabajo.controls.some(
      (ctrl, i) =>
        i !== index &&
        (ctrl.value ?? '').toString().trim() === fecha &&
        !!fecha,
    );
    if (duplicada) {
      control.setValue(prev[index] ?? '', { emitEvent: false });
      this.showAlert(
        'warning',
        'Fecha repetida',
        'Cada día de trabajo debe tener una fecha diferente.',
      );
      return;
    }
    const changingExistingDate = !!fechaAnterior && fechaAnterior !== fecha;
    if (!changingExistingDate) {
      control.setValue(fecha, { emitEvent: false });
      this.ordenarFechasTrabajo();
      const next = this.getFechasTrabajoRaw();
      this.fechasTrabajoSnapshot = next;
      this.syncFechaEventoDesdeFechasTrabajo();
      return;
    }
    if (!this.hasLocacionesRegistradas()) {
      control.setValue(fecha, { emitEvent: false });
      this.remapFechaLocacionesYAsignaciones(fechaAnterior, fecha);
      this.ordenarFechasTrabajo();
      const next = this.getFechasTrabajoRaw();
      this.fechasTrabajoSnapshot = next;
      this.syncFechaEventoDesdeFechasTrabajo();
      return;
    }
    void this.fireSwal({
      icon: 'warning',
      title: 'Cambiar fecha de trabajo',
      html: `
        <p>Ya tienes locaciones registradas.</p>
        <p class="mb-0">¿Seguro que deseas cambiar <b>${this.formatFechaConDia(fechaAnterior)}</b> por <b>${this.formatFechaConDia(fecha)}</b>?</p>
      `,
      showCancelButton: true,
      confirmButtonText: 'SÍ, cambiar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) {
        control.setValue(fechaAnterior, { emitEvent: false });
        return;
      }
      control.setValue(fecha, { emitEvent: false });
      this.remapFechaLocacionesYAsignaciones(fechaAnterior, fecha);
      this.ordenarFechasTrabajo();
      const next = this.getFechasTrabajoRaw();
      this.fechasTrabajoSnapshot = next;
      this.syncFechaEventoDesdeFechasTrabajo();
    });
  }

  addProgramacionItem(fechaForzada?: string): void {
    if (!this.canContinueFlow()) {
      return;
    }
    const fechaConfig = this.getFechaProgramacionNuevaFila(fechaForzada);
    if (!fechaConfig) {
      this.showAlert(
        'warning',
        'Fecha requerida',
        'Primero define una fecha de trabajo para agregar locaciones.',
      );
      return;
    }

    const actuales = this.getProgramacionIndicesPorFecha(fechaConfig).length;
    if (actuales >= this.maxLocacionesPorDia) {
      this.showAlert(
        'warning',
        'Límite alcanzado',
        `Máximo ${this.maxLocacionesPorDia} locaciones por día (${this.formatFechaConDia(fechaConfig)}).`,
      );
      return;
    }

    // … NO autollenar el nombre
    const nuevoGrupo = this.createProgramacionItem({
      nombre: '', // <-- vacío para que se vea el placeholder
      fecha: fechaConfig,
    });

    this.setProgramacionExpandida(nuevoGrupo, this.programacion.length === 0);
    this.programacion.push(nuevoGrupo);

    this.ensureProgramacionPrincipales();
    this.syncProgramacionFechas();
  }

  duplicarProgramacionItem(index: number): void {
    if (!this.canContinueFlow()) {
      return;
    }
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
      this.showAlert(
        'warning',
        'Límite alcanzado',
        `Máximo ${this.maxLocacionesPorDia} locaciones por día.`,
      );
      return;
    }
    const duplicado = this.createProgramacionItem({
      nombre: (raw['nombre'] ?? '').toString().trim(),
      direccion: (raw['direccion'] ?? '').toString().trim(),
      hora: (raw['hora'] ?? '').toString().trim(),
      notas: (raw['notas'] ?? '').toString().trim(),
      fecha,
    });
    this.programacion.insert(index + 1, duplicado);
    this.setProgramacionExpandida(duplicado, true);
    this.syncProgramacionFechas();
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
    if (this.isProgramacionIncompleta(index)) {
      return 'Incompleta';
    }
    return 'Completa';
  }

  getProgramacionEstadoClass(index: number): string {
    if (this.isProgramacionIncompleta(index)) {
      return 'programacion-status--warn';
    }
    return 'programacion-status--ok';
  }

  removeProgramacionItem(index: number): void {
    if (!this.canContinueFlow()) {
      return;
    }
    if (index < 0 || index >= this.programacion.length) {
      return;
    }

    const grupo = this.programacion.at(index) as UntypedFormGroup | null;
    const nombre =
      (grupo?.get('nombre')?.value ?? '').toString().trim() ||
      `locación ${index + 1}`;

    void this.fireSwal({
      icon: 'warning',
      title: 'Eliminar locación',
      text: `¿Quieres eliminar "${nombre}" de la programación?`,
      showCancelButton: true,
      confirmButtonText: 'SÍ, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.programacion.removeAt(index);
      this.ensureProgramacionPrincipales();
      this.syncProgramacionFechas();
      this.showToast(
        'success',
        'locación eliminada',
        'Se eliminó la locación seleccionada.',
      );
    });
  }

  canCopiarDiaAnterior(diaIndex: number): boolean {
    return diaIndex > 0;
  }

  copiarLocacionesDiaAnterior(diaIndex: number, fechaDestino: string): void {
    if (diaIndex <= 0) {
      return;
    }
    const fechaOrigen = (this.fechasTrabajoValores[diaIndex - 1] ?? '')
      .toString()
      .trim();
    const destino = (fechaDestino ?? '').toString().trim();
    if (!fechaOrigen || !destino) {
      return;
    }
    const indicesOrigen = this.getProgramacionIndicesPorFecha(fechaOrigen);
    if (!indicesOrigen.length) {
      this.showAlert(
        'info',
        'Sin datos para copiar',
        'El día anterior no tiene locaciones registradas.',
      );
      return;
    }
    const indicesDestino = this.getProgramacionIndicesPorFecha(destino);
    const ejecutarCopia = () => {
      const origenRaw = indicesOrigen
        .map((idx) => this.programacion.at(idx) as UntypedFormGroup)
        .filter(Boolean)
        .map((grupo) => grupo.getRawValue() as Record<string, unknown>)
        .slice(0, this.maxLocacionesPorDia);
      for (let i = indicesDestino.length - 1; i >= 0; i -= 1) {
        this.programacion.removeAt(indicesDestino[i]);
      }
      origenRaw.forEach((raw, pos) => {
        const nuevo = this.createProgramacionItem({
          nombre: (raw['nombre'] ?? '').toString().trim(),
          direccion: (raw['direccion'] ?? '').toString().trim(),
          hora: (raw['hora'] ?? '').toString().trim(),
          notas: (raw['notas'] ?? '').toString().trim(),
          fecha: destino,
        });
        this.programacion.push(nuevo);
        this.setProgramacionExpandida(nuevo, pos === 0);
      });
      this.syncProgramacionFechas();
      this.showToast(
        'success',
        'Locaciones copiadas',
        'Se copiaron las locaciones del día anterior.',
      );
    };

    if (indicesDestino.length) {
      void this.fireSwal({
        icon: 'warning',
        title: 'Reemplazar locaciones del día',
        text: 'Se reemplazaran las locaciones actuales de este día con las del día anterior.',
        showCancelButton: true,
        confirmButtonText: 'SÍ, reemplazar',
        cancelButtonText: 'Cancelar',
      }).then((result) => {
        if (result.isConfirmed) {
          ejecutarCopia();
        }
      });
      return;
    }
    ejecutarCopia();
  }

  getResumenDia(fecha: string): { total: number; primera: string } {
    const indices = this.getProgramacionIndicesPorFecha(fecha);
    const horas = indices
      .map((index) => {
        const grupo = this.programacion.at(index) as UntypedFormGroup;
        return ((grupo.getRawValue() as Record<string, unknown>)['hora'] ?? '')
          .toString()
          .trim();
      })
      .filter(Boolean)
      .sort();
    return {
      total: indices.length,
      primera: horas[0] ? this.formatHoraTexto(horas[0]) : '--',
    };
  }

  get totalSeleccion(): number {
    const subtotal = this.selectedPaquetes.reduce((acc, item) => {
      const precio = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + precio * cantidad;
    }, 0);
    return subtotal + this.getViaticosMontoTotal();
  }

  get totalPaquetes(): number {
    return this.selectedPaquetes.reduce((acc, item) => {
      const precio = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + precio * cantidad;
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

  onServicioChange(servicioId: number | null | undefined): void {
    if (!this.canContinueFlow()) {
      this.selectedServicioId = null;
      this.selectedServicioNombre = '';
      this.paquetesRows = [];
      return;
    }
    const parsed = this.parseNumber(servicioId);
    this.selectedServicioId = parsed ?? null;
    if (this.selectedServicioId == null) {
      this.selectedServicioNombre = '';
    } else {
      const selected = this.servicios.find(
        (s) => this.getId(s) === this.selectedServicioId,
      );
      this.selectedServicioNombre = this.getNombre(selected);
    }
    this.loadEventosServicio();
  }

  onServicioDropdownChange(rawValue: string): void {
    this.onServicioChange(this.parseNumber(rawValue));
  }

  onEventoDropdownChange(event: Event): void {
    this.eventoSelectTouched = true;
    const target = event.target as HTMLSelectElement | null;
    const rawValue = target?.value ?? '';
    const nextEventoId = this.parseNumber(rawValue);
    const prevEventoId = this.selectedEventoId;
    const prevValue = prevEventoId != null ? String(prevEventoId) : '';
    if (
      this.selectedPaquetes.length &&
      nextEventoId !== this.selectedEventoId
    ) {
      void this.fireSwal({
        icon: 'warning',
        title: 'Cambiar tipo de evento',
        text: 'Cambiar el tipo de evento eliminara toda la selección de paquetes.',
        confirmButtonText: 'Cambiar',
        cancelButtonText: 'Cancelar',
        showCancelButton: true,
        reverseButtons: true,
      }).then((result) => {
        if (!result.isConfirmed) {
          if (target) {
            target.value = prevValue;
          }
          return;
        }
        this.selectedPaquetes = [];
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
    if (this.selectedEventoId == null) {
      this.selectedEventoNombre = '';
      this.selectedEventoDetalle = null;
      this.syncDatosEventoControls();
    } else {
      const selected = this.eventos.find(
        (e) => this.getId(e) === this.selectedEventoId,
      );
      this.selectedEventoNombre = this.getNombre(selected);
      this.cargarEventoSeleccionado(this.selectedEventoId);
    }
    this.applyEventoGateRules();
    this.loadEventosServicio();
  }

  addPaquete(element: AnyRecord): void {
    if (!this.canContinueFlow()) {
      return;
    }
    const key = this.getPkgKey(element);
    if (this.selectedPaquetes.some((p) => p.key === key)) {
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
    const servicioNombreActual = (
      servicioNombre ??
      this.selectedServicioNombre ??
      ''
    ).toLowerCase();
    const esMismoServicio = (item: PaqueteSeleccionado): boolean => {
      if (servicioId != null) {
        return (item.servicioId ?? null) === servicioId;
      }
      return (
        (item.servicioId ?? null) == null &&
        (item.servicioNombre ?? '').toLowerCase() === servicioNombreActual
      );
    };
    const reemplazados = this.selectedPaquetes.filter(esMismoServicio);
    const restantes = this.selectedPaquetes.filter(
      (item) => !esMismoServicio(item),
    );
    const cantidadMaxima = this.getCantidadMaximaPorDias();
    const cantidadBase = Math.max(
      1,
      Number(reemplazados[0]?.cantidad ?? 1) || 1,
    );
    const cantidadInicial =
      cantidadMaxima != null
        ? Math.min(cantidadBase, cantidadMaxima)
        : cantidadBase;
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
        grupo: grupo,
        opcion: opcion,
        staff: staff ?? undefined,
        horas: horas ?? undefined,
        fotosImpresas: fotosImpresas ?? undefined,
        trailerMin: trailerMin ?? undefined,
        filmMin: filmMin ?? undefined,
        descuento: descuento,
        recargo: recargo,
        notas: '',
        eventoServicioId: eventoServicioId ?? undefined,
        servicioId: servicioId,
        servicioNombre: servicioNombre ?? this.selectedServicioNombre,
        origen: element,
        precioOriginal: precioBase,
        editandoPrecio: false,
      },
    ];
    this.tmpIdSequence += 1;
    if (this.serviciosFechasSeleccionadas.length) {
      const replacedTmpIds = new Set(reemplazados.map((item) => item.tmpId));
      const tmpIds = new Set(this.selectedPaquetes.map((item) => item.tmpId));
      const migradas = this.serviciosFechasSeleccionadas
        .map((entry) =>
          replacedTmpIds.has(entry.itemTmpId)
            ? { ...entry, itemTmpId: nextTmpId }
            : entry,
        )
        .filter((entry) => tmpIds.has(entry.itemTmpId));
      const nuevas = migradas
        .filter((entry) => entry.itemTmpId === nextTmpId)
        .slice(0, cantidadInicial);
      this.serviciosFechasSeleccionadas = [
        ...migradas.filter((entry) => entry.itemTmpId !== nextTmpId),
        ...nuevas,
      ];
    }
    this.autoAsignarFechasSiCantidadMaxima(nextTmpId, cantidadInicial);
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
    if (!this.canContinueFlow()) {
      return;
    }
    const removed = this.selectedPaquetes.find((p) => p.key === key);
    this.selectedPaquetes = this.selectedPaquetes.filter((p) => p.key !== key);
    if (removed?.tmpId) {
      this.serviciosFechasSeleccionadas =
        this.serviciosFechasSeleccionadas.filter(
          (entry) => entry.itemTmpId !== removed.tmpId,
        );
    }
    this.syncTotalEstimado();
  }

  mostrarDetallePaquete(row: PaqueteRow): void {
    this.detallePaqueteSeleccionado = row?.raw ?? null;
    this.detallePaqueteAbierto = !!this.detallePaqueteSeleccionado;
  }

  cerrarDetallePaquete(): void {
    this.detallePaqueteAbierto = false;
    this.detallePaqueteSeleccionado = null;
  }

  abrirAsignacionFechas(): void {
    if (!this.canContinueFlow()) {
      return;
    }
    if (!this.isMultipleDias()) {
      return;
    }
    const fechasUnicas = Array.from(
      new Set(
        (this.programacion.getRawValue() as Record<string, unknown>[])
          .map((config) => (config['fecha'] ?? '').toString().trim())
          .filter(Boolean),
      ),
    ).sort();
    this.fechasDisponibles = fechasUnicas.length
      ? fechasUnicas
      : this.form.get('fechaEvento')?.value
        ? [String(this.form.get('fechaEvento')?.value)]
        : [];
    if (!this.fechasDisponibles.length) {
      this.showAlert(
        'warning',
        'Fechas pendientes',
        'Registra fechas en la programación para asignarlas a los servicios.',
      );
      return;
    }
    this.serviciosFechasSeleccionadas =
      this.serviciosFechasSeleccionadas.filter((entry) =>
        this.fechasDisponibles.includes(entry.fecha),
      );
    this.asignacionFechasAbierta = true;
  }

  cerrarAsignacionFechas(): void {
    this.asignacionFechasAbierta = false;
  }

  isFechaAsignada(itemTmpId: string, fecha: string): boolean {
    return this.serviciosFechasSeleccionadas.some(
      (entry) => entry.itemTmpId === itemTmpId && entry.fecha === fecha,
    );
  }

  toggleFechaAsignada(
    itemTmpId: string,
    fecha: string,
    checked: boolean,
    maxCantidad: number,
  ): void {
    if (checked) {
      const count = this.serviciosFechasSeleccionadas.filter(
        (entry) => entry.itemTmpId === itemTmpId,
      ).length;
      if (count >= maxCantidad) {
        this.showAlert(
          'info',
          'Cantidad completa',
          'Ya asignaste todas las fechas requeridas para este servicio.',
        );
        return;
      }
      this.serviciosFechasSeleccionadas = [
        ...this.serviciosFechasSeleccionadas,
        { itemTmpId, fecha },
      ];
      return;
    }
    this.serviciosFechasSeleccionadas =
      this.serviciosFechasSeleccionadas.filter(
        (entry) => !(entry.itemTmpId === itemTmpId && entry.fecha === fecha),
      );
  }

  getCantidadAsignada(itemTmpId: string): number {
    return this.serviciosFechasSeleccionadas.filter(
      (entry) => entry.itemTmpId === itemTmpId,
    ).length;
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

  getDetalleStaffTotal(
    paquete: PaqueteDetalle | null | undefined,
  ): string | number {
    if (!paquete) {
      return '';
    }
    const staff = paquete.staff;
    if (typeof staff === 'number') {
      return staff;
    }
    const eventoStaff = paquete.eventoServicio?.staff;
    const eventoTotal =
      typeof eventoStaff === 'number' ? eventoStaff : eventoStaff?.total;
    const total = staff?.total ?? eventoTotal ?? paquete.personal;
    return total ?? '';
  }

  onClienteSelected(cliente: ClienteBusquedaResultado): void {
    if (!cliente) {
      return;
    }
    this.clienteSeleccionado = cliente;
    const nombre = this.resolveClienteNombre(cliente);
    const contacto = this.resolveClienteContacto(cliente);
    this.clienteSearchControl.setValue(nombre, { emitEvent: false });
    this.clienteBusquedaTermino = nombre;
    const patch: Record<string, unknown> = {};
    if (nombre) {
      patch.clienteNombre = nombre;
    }
    if (contacto) {
      patch.clienteContacto = this.sanitizeContacto(contacto);
    }
    if (Object.keys(patch).length) {
      this.form.patchValue(patch, { emitEvent: false });
    }
    this.setClienteControlsDisabled(true);
    this.clienteSearchControl.disable({ emitEvent: false });
    this.clienteResultados = [];
    this.clienteSearchLoading = false;
    this.clienteSearchError = '';
  }

  clearClienteSeleccionado(): void {
    this.clienteSeleccionado = null;
    this.setClienteControlsDisabled(false);
    this.clienteSearchControl.setValue('', { emitEvent: false });
    this.clienteBusquedaTermino = '';
    this.form.get('clienteNombre')?.reset('', { emitEvent: false });
    this.form.get('clienteContacto')?.reset('', { emitEvent: false });
    this.clienteResultados = [];
    this.clienteSearchError = '';
    this.clienteSearchLoading = false;
    this.clienteSearchControl.enable({ emitEvent: false });
  }

  private initClienteBusqueda(): void {
    this.clienteSearchControl.valueChanges
      .pipe(
        map((value) => (typeof value === 'string' ? value.trim() : '')),
        tap((value) => {
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
        filter((value) => value.length > 1),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          this.clienteSearchLoading = true;
        }),
        switchMap((query) =>
          this.cotizacionService.buscarClientes(query).pipe(
            catchError((err) => {
              console.error('[cotizacion] buscarClientes', err);
              this.clienteSearchError = 'No pudimos cargar clientes.';
              this.clienteSearchLoading = false;
              this.showAlert(
                'error',
                'No pudimos cargar clientes.',
                'Inténtalo nuevamente.',
              );
              return of([]);
            }),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.clienteResultados = Array.isArray(result) ? result : [];
        this.clienteSearchLoading = false;
      });
  }

  resolveClienteDocumento(cliente?: ClienteBusquedaResultado | null): string {
    if (!cliente) {
      return '';
    }
    return (
      cliente.documento ??
      cliente.numeroDocumento ??
      cliente.ruc ??
      cliente.identificador ??
      ''
    ).toString();
  }

  resolveClienteContacto(cliente?: ClienteBusquedaResultado | null): string {
    if (!cliente) {
      return '';
    }
    return (
      cliente.contacto ??
      cliente.celular ??
      cliente.telefono ??
      cliente.whatsapp ??
      cliente.email ??
      cliente.correo ??
      ''
    ).toString();
  }

  private sanitizeContacto(valor: string): string {
    return (valor ?? '').toString().replace(/\D/g, '');
  }

  private setClienteControlsDisabled(disabled: boolean): void {
    ['clienteNombre', 'clienteContacto'].forEach((key) => {
      const control = this.form.get(key);
      if (!control) {
        return;
      }
      if (disabled) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    });
  }

  resolveClienteNombre(cliente: ClienteBusquedaResultado): string {
    return (
      cliente.nombreCompleto ??
      cliente.nombre ??
      cliente.razonSocial ??
      cliente.contacto ??
      cliente.email ??
      ''
    ).toString();
  }

  pkgKey = (el: AnyRecord) => this.getPkgKey(el);

  isInSeleccion(element: AnyRecord): boolean {
    const key = this.getPkgKey(element);
    return this.selectedPaquetes.some((p) => p.key === key);
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
      return this.selectedPaquetes.some(
        (p) =>
          (p.servicioId ?? null) == null &&
          (p.servicioNombre ?? '').toLowerCase() === nombreComparacion &&
          p.key !== key,
      );
    }
    const key = this.getPkgKey(element);
    return this.selectedPaquetes.some(
      (p) => (p.servicioId ?? null) === servicioId && p.key !== key,
    );
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
    if (
      !Number.isFinite(original) ||
      original <= 0 ||
      !Number.isFinite(actual)
    ) {
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
    this.selectedPaquetes = this.selectedPaquetes.map((item) =>
      item.key === key ? { ...item, editandoPrecio: true } : item,
    );
    this.focusPrecioInput(key);
  }

  confirmPrecioEdit(
    paquete: PaqueteSeleccionado,
    rawValue: string | number | null | undefined,
  ): void {
    const key = paquete.key;
    const current = this.selectedPaquetes.find((item) => item.key === key);
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
      this.showAlert(
        'info',
        'Ajuste no permitido',
        'Solo puedes reducir el precio hasta un 5% respecto al valor base.',
      );
    }

    this.selectedPaquetes = this.selectedPaquetes.map((item) =>
      item.key === key
        ? { ...item, precio: value, editandoPrecio: false }
        : item,
    );
    this.syncTotalEstimado();
  }

  cancelPrecioEdit(paquete: PaqueteSeleccionado): void {
    const key = paquete.key;
    this.selectedPaquetes = this.selectedPaquetes.map((item) =>
      item.key === key ? { ...item, editandoPrecio: false } : item,
    );
  }

  onCantidadChange(paquete: PaqueteSeleccionado, value: unknown): void {
    if (!this.canContinueFlow()) {
      return;
    }
    const parsed = this.parseNumber(value);
    const base = parsed != null && parsed >= 1 ? Math.floor(parsed) : 1;
    const max = this.getCantidadMaximaPorDias();
    paquete.cantidad = max != null ? Math.min(base, max) : base;
    if (paquete.tmpId) {
      let count = 0;
      this.serviciosFechasSeleccionadas =
        this.serviciosFechasSeleccionadas.filter((entry) => {
          if (entry.itemTmpId !== paquete.tmpId) {
            return true;
          }
          if (count < paquete.cantidad) {
            count += 1;
            return true;
          }
          return false;
        });
      this.autoAsignarFechasSiCantidadMaxima(paquete.tmpId, paquete.cantidad);
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

  submit(): void {
    if (this.loading) {
      return;
    }
    const formInvalido = this.form.invalid;
    const eventoInvalido = this.selectedEventoId == null;
    const programacionInvalida = this.programacion.invalid;
    const programacionVacia = this.programacion.length === 0;
    const datosEventoInvalido = this.datosEventoGroup.invalid;

    if (
      formInvalido ||
      eventoInvalido ||
      programacionInvalida ||
      programacionVacia ||
      datosEventoInvalido
    ) {
      if (formInvalido) {
        this.form.markAllAsTouched();
      }
      if (datosEventoInvalido) {
        this.datosEventoGroup.markAllAsTouched();
      }
      if (programacionInvalida || programacionVacia) {
        this.programacion.markAllAsTouched();
        this.expandirProgramacionConErrores();
      }
      if (eventoInvalido) {
        this.eventoSelectTouched = true;
      }

      const mensaje = eventoInvalido
        ? 'Selecciona un tipo de evento.'
        : datosEventoInvalido
          ? 'Completa los datos del evento.'
        : programacionVacia
          ? 'Agrega al menos una locación.'
          : programacionInvalida
            ? 'Completa la programación del evento.'
            : 'Revisa los campos obligatorios.';

      this.showAlert('warning', 'Falta información', mensaje);
      return;
    }

    if (!this.selectedPaquetes.length) {
      this.showAlert(
        'warning',
        'Agrega paquetes',
        'Selecciona al menos un paquete para la Cotización.',
      );
      return;
    }

    const raw = this.form.getRawValue();
    const diasNumero = this.parseNumber(raw.dias);
    const restriccionesProgramacion =
      this.validarRestriccionesProgramacion(diasNumero);
    if (restriccionesProgramacion.length) {
      this.showAlertHtml(
        'warning',
        'Revisa la programación',
        `<ul class="text-start mb-0">${restriccionesProgramacion.map((item) => `<li>${item}</li>`).join('')}</ul>`,
      );
      return;
    }
    if (diasNumero != null && diasNumero > 2) {
      const totalCantidad = this.getTotalCantidadSeleccionada();
      if (totalCantidad < diasNumero) {
        this.showAlert(
          'warning',
          'Cantidades insuficientes',
          `Para ${diasNumero} días debes asignar al menos ${diasNumero} servicios en total.`,
        );
        return;
      }
    }
    const clienteNombre = (raw.clienteNombre ?? '').toString().trim();
    const clienteContacto = this.sanitizeContacto(
      (raw.clienteContacto ?? '').toString(),
    );
    const fechaEventoForm = raw.fechaEvento;
    const departamento = (raw.departamento ?? '').toString().trim();
    const viaticosCliente = Boolean(raw.viaticosCliente);
    const viaticosMonto = this.parseNumber(raw.viaticosMonto);
    const horasEstimadas = (raw.horasEstimadas ?? '').toString().trim();
    const diasTexto = (raw.dias ?? '').toString().trim();
    const descripcionBase = (raw.descripcion ?? '').toString().trim();
    const datosEventoPayload = this.buildDatosEventoPayload();
    const descripcion =
      descripcionBase ||
      (clienteNombre
        ? `Solicitud de cotizacion de ${clienteNombre}`
        : 'Solicitud de cotizacion');
    const horasEstimadasNumero = this.parseHorasToNumber(horasEstimadas);
    const programacionRaw = this.programacion.getRawValue() as Record<
      string,
      unknown
    >[];
    const eventos: CotizacionAdminEventoPayload[] = programacionRaw
      .map((config) => {
        const fecha = ((config['fecha'] ?? fechaEventoForm) || '')
          .toString()
          .trim();
        const hora = (config['hora'] ?? '').toString().trim();
        const ubicacion = (config['nombre'] ?? '').toString().trim();
        const direccion = (config['direccion'] ?? '').toString().trim();
        const notasTexto = (config['notas'] ?? '').toString().trim();
        if (!fecha && !hora && !ubicacion && !direccion && !notasTexto) {
          return null;
        }
        const horaNormalizada = hora
          ? /^\d{2}:\d{2}$/.test(hora)
            ? `${hora}:00`
            : hora
          : undefined;
        const evento: CotizacionAdminEventoPayload = {
          fecha: fecha || undefined,
          hora: horaNormalizada,
          ubicacion: ubicacion || undefined,
          direccion: direccion || undefined,
          notas: notasTexto ? notasTexto : null,
        };
        return evento;
      })
      .filter(
        (evento): evento is CotizacionAdminEventoPayload => evento != null,
      );
    const fechaEvento = this.isMultipleDias()
      ? (eventos.find((ev) => ev.fecha)?.fecha ?? '')
      : fechaEventoForm;

    const clienteIdSeleccionado = this.parseNumber(
      this.clienteSeleccionado?.id,
    );
    const items: CotizacionAdminItemPayload[] = this.selectedPaquetes.map(
      (item, index) => {
        const notas = (item.notas ?? '').toString().trim();
        const eventoServicioId =
          this.getEventoServicioId(item) ??
          this.getEventoServicioId(item.origen);
        const servicioId = this.getPaqueteServicioId(item);
        const horas = this.parseNumber(
          item.horas ?? this.getHoras(item.origen),
        );
        const staff = this.parseNumber(
          item.staff ?? this.getStaff(item.origen),
        );
        const fotosImpresas = this.parseNumber(
          item.fotosImpresas ?? this.getFotosImpresas(item.origen),
        );
        const trailerMin = this.parseNumber(
          item.trailerMin ?? this.getTrailerMin(item.origen),
        );
        const filmMin = this.parseNumber(
          item.filmMin ?? this.getFilmMin(item.origen),
        );

        const payloadItem: CotizacionAdminItemPayload = {
          tmpId: item.tmpId ?? `i${index + 1}`,
          idEventoServicio: eventoServicioId ?? undefined,
          eventoId: this.selectedEventoId ?? undefined,
          servicioId: servicioId ?? undefined,
          titulo: item.titulo,
          descripcion: item.descripcion || undefined,
          moneda: item.moneda ?? this.getMoneda(item.origen) ?? 'USD',
          precioUnitario: Number(item.precio) || 0,
          cantidad: Number(item.cantidad ?? 1) || 1,
          notas: notas || undefined,
          horas: horas ?? undefined,
          personal: staff ?? undefined,
          fotosImpresas: fotosImpresas ?? undefined,
          trailerMin: trailerMin ?? undefined,
          filmMin: filmMin ?? undefined,
        };

        return payloadItem;
      },
    );
    const fechasUnicas = Array.from(
      new Set(
        programacionRaw
          .map((config) => (config['fecha'] ?? '').toString().trim())
          .filter(Boolean),
      ),
    ).sort();
    const fechasBase = fechasUnicas.length
      ? fechasUnicas
      : fechaEventoForm
        ? [String(fechaEventoForm)]
        : [];
    const serviciosFechasAuto = items.flatMap((item, index) => {
      const itemTmpId = item.tmpId ?? `i${index + 1}`;
      const cantidad = Math.max(1, Number(item.cantidad ?? 1) || 1);
      const fechas = fechasBase.slice(0, cantidad);
      return fechas.map((fecha) => ({ itemTmpId, fecha }));
    });
    const serviciosFechas = this.isMultipleDias()
      ? this.serviciosFechasSeleccionadas.filter((entry) =>
          items.some((item) => (item.tmpId ?? '') === entry.itemTmpId),
        )
      : serviciosFechasAuto;

    if (this.isMultipleDias()) {
      const pendiente = items.find((item, index) => {
        const itemTmpId = item.tmpId ?? `i${index + 1}`;
        const cantidad = Math.max(1, Number(item.cantidad ?? 1) || 1);
        const asignadas = serviciosFechas.filter(
          (entry) => entry.itemTmpId === itemTmpId,
        ).length;
        return asignadas !== cantidad;
      });
      if (pendiente) {
        this.showAlert(
          'warning',
          'Asignación pendiente',
          'Completa la asignación de fechas para todos los servicios.',
        );
        return;
      }
      const fechasSinAsignar = fechasBase.filter(
        (fecha) => !serviciosFechas.some((entry) => entry.fecha === fecha),
      );
      if (fechasSinAsignar.length) {
        this.showAlert(
          'warning',
          'Fechas sin cobertura',
          'Debes asignar al menos un servicio a cada día.',
        );
        return;
      }
    }

    const payload: CotizacionAdminCreatePayload = {
      cotizacion: {
        idTipoEvento: this.selectedEventoId ?? undefined,
        tipoEvento:
          this.selectedEventoNombre || this.selectedServicioNombre || 'Evento',
        fechaEvento,
        lugar: departamento || undefined,
        datosEvento:
          Object.keys(datosEventoPayload).length > 0
            ? datosEventoPayload
            : undefined,
        dias: diasNumero ?? undefined,
        horasEstimadas: horasEstimadasNumero ?? undefined,
        mensaje: descripcion,
        estado: 'Borrador',
        viaticosCliente:
          departamento.toLowerCase() === 'lima' ? true : viaticosCliente,
        viaticosMonto:
          departamento.toLowerCase() === 'lima'
            ? undefined
            : viaticosCliente
              ? undefined
              : (viaticosMonto ?? undefined),
      },
      lead: {
        nombre: clienteNombre || undefined,
        celular: clienteContacto || undefined,
        origen: 'Backoffice',
      },
      items,
      serviciosFechas: serviciosFechas.length ? serviciosFechas : undefined,
      eventos: eventos.length ? eventos : undefined,
    };

    if (clienteIdSeleccionado != null) {
      payload.cliente = { id: clienteIdSeleccionado };
    }

    // Detener envío real para pruebas: solo mostramos el payload.

    this.loading = true;
    this.cotizacionService
      .createCotizacion(payload)
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          void this.fireSwal({
            icon: 'success',
            title: 'Cotización registrada',
            text: 'La Cotización se registró correctamente.',
          }).then(() => this.router.navigate(['/home/gestionar-cotizaciones']));
        },
        error: (err) => {
          console.error('[cotizacion] create', err);
          this.showAlert(
            'error',
            'Error al registrar',
            'No pudimos registrar la Cotización. Inténtalo nuevamente.',
          );
        },
      });
  }

  cancel(): void {
    if (!this.hasCambiosSinGuardar()) {
      this.router.navigate(['/home/gestionar-cotizaciones']);
      return;
    }

    void this.fireSwal({
      icon: 'warning',
      title: 'Descartar cambios',
      text: 'Tienes cambios sin guardar en la Cotización. Si sales ahora, se perderan.',
      showCancelButton: true,
      confirmButtonText: 'Salir sin guardar',
      cancelButtonText: 'Seguir editando',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/home/gestionar-cotizaciones']);
      }
    });
  }

  private hasCambiosSinGuardar(): boolean {
    if (this.form.dirty) {
      return true;
    }

    if (this.selectedPaquetes.length > 0) {
      return true;
    }

    if (this.programacion.length > 0 || this.fechasTrabajo.length > 0) {
      return true;
    }

    if (this.serviciosFechasSeleccionadas.length > 0) {
      return true;
    }

    if (this.selectedEventoId != null || this.clienteSeleccionado != null) {
      return true;
    }

    const raw = this.form.getRawValue() as Record<string, unknown>;
    const clienteNombre = (raw['clienteNombre'] ?? '').toString().trim();
    const clienteContacto = (raw['clienteContacto'] ?? '').toString().trim();
    const descripcion = (raw['descripcion'] ?? '').toString().trim();
    const dias = Number(raw['dias'] ?? 0);
    const fechaEvento = (raw['fechaEvento'] ?? '').toString().trim();
    const viaticosCliente = !!raw['viaticosCliente'];
    const viaticosMonto = Number(raw['viaticosMonto'] ?? 0);

    return (
      !!clienteNombre ||
      !!clienteContacto ||
      !!descripcion ||
      Number.isFinite(dias) && dias > 0 ||
      (!!fechaEvento && fechaEvento !== this.fechaMinimaEvento) ||
      !viaticosCliente ||
      (Number.isFinite(viaticosMonto) && viaticosMonto > 0)
    );
  }

  private syncProgramacionFechas(fecha?: string | null): void {
    const fechaReferencia = (fecha ?? this.form.get('fechaEvento')?.value ?? '')
      .toString()
      .trim();
    this.programacion.controls.forEach((control) => {
      const grupo = control as UntypedFormGroup;
      const fechaControl = grupo.get('fecha');
      if (!fechaControl) {
        return;
      }
      const actual = (fechaControl.value ?? '').toString().trim();
      if (!actual && fechaReferencia) {
        fechaControl.setValue(fechaReferencia, { emitEvent: false });
      }
      if (!fechaControl.disabled) {
        fechaControl.disable({ emitEvent: false });
      }
    });
  }

  private createProgramacionItem(
    config: ProgramacionEventoItemConfig = {},
  ): UntypedFormGroup {
    const hora24 = this.normalizeHora24(config.hora ?? '');
    const horaParts = this.splitHoraTo12(hora24);
    const grupo = this.fb.group({
      nombre: [config.nombre ?? '', Validators.required],
      direccion: [config.direccion ?? '', Validators.required],
      fecha: [{ value: config.fecha ?? '', disabled: true }],
      hora: [
        hora24,
        [
          Validators.required,
          Validators.pattern(/^\d{2}:\d{2}$/),
          this.horaRangoValidator(),
        ],
      ],
      hora12: [horaParts.hora12, Validators.required],
      minuto: [horaParts.minuto, Validators.required],
      ampm: [horaParts.ampm, Validators.required],
      notas: [config.notas ?? ''],
      esPrincipal: [config.esPrincipal ?? false],
    });
    this.bindHoraControls(grupo);
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

    ['hora12', 'minuto', 'ampm'].forEach((controlName) => {
      grupo
        .get(controlName)
        ?.valueChanges.pipe(takeUntil(this.destroy$))
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
      .subscribe((value) => {
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
          if (
            fechaAnterior &&
            fechaAnterior !== fecha &&
            this.serviciosFechasSeleccionadas.length
          ) {
            const fechasActuales = this.getFechasProgramacionUnicas();
            if (!fechasActuales.includes(fechaAnterior)) {
              this.serviciosFechasSeleccionadas =
                this.serviciosFechasSeleccionadas.map((entry) =>
                  entry.fecha === fechaAnterior ? { ...entry, fecha } : entry,
                );
            }
          }
          lastValid = value;
          return;
        }
        const fechaAnterior = (lastValid ?? '').toString().trim();
        const fechasPermitidas = fechasUnicas.filter((item) => item !== fecha);
        const fechasTexto = fechasPermitidas.slice(0, maxDias);
        if (!fechaAnterior) {
          fechaControl.setValue(lastValid ?? '', { emitEvent: false });
          void this.fireSwal({
            icon: 'warning',
            title: 'Días ya definidos',
            html: `
              <p>Ya seleccionaste ${maxDias} día(s):</p>
              <ul class="text-start mb-0">
                ${fechasTexto.map((item) => `<li>${this.formatFechaConDia(item)}</li>`).join('')}
              </ul>
            `,
            confirmButtonText: 'Entendido',
          });
          return;
        }
        void this.fireSwal({
          icon: 'warning',
          title: 'Cambiar fechas',
          html: `
            <p>Ya seleccionaste ${maxDias} día(s):</p>
            <ul class="text-start mb-3">
              ${fechasTexto.map((item) => `<li>${this.formatFechaConDia(item)}</li>`).join('')}
            </ul>
            <p class="mb-0">¿Quieres cambiar todas las locaciones del día <b>${this.formatFechaConDia(fechaAnterior)}</b> al día <b>${this.formatFechaConDia(fecha)}</b>?</p>
          `,
          showCancelButton: true,
          confirmButtonText: 'SÍ, cambiar todas',
          cancelButtonText: 'Cancelar',
        }).then((result) => {
          if (!result.isConfirmed) {
            fechaControl.setValue(lastValid ?? '', { emitEvent: false });
            return;
          }
          this.programacion.controls.forEach((control) => {
            const controlFecha = (control as UntypedFormGroup).get('fecha');
            if (controlFecha?.value === fechaAnterior) {
              controlFecha.setValue(fecha, { emitEvent: false });
            }
          });
          if (this.serviciosFechasSeleccionadas.length) {
            this.serviciosFechasSeleccionadas =
              this.serviciosFechasSeleccionadas.map((entry) =>
                entry.fecha === fechaAnterior ? { ...entry, fecha } : entry,
              );
          }
          lastValid = fecha;
        });
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

  canAgregarLocacion(fecha: string): boolean {
    return (
      this.getProgramacionIndicesPorFecha(fecha).length <
      this.maxLocacionesPorDia
    );
  }

  private getFechasProgramacionUnicas(): string[] {
    const fechas = this.programacion.controls
      .map((control) => (control as UntypedFormGroup).get('fecha')?.value)
      .map((value) => (value ?? '').toString().trim())
      .filter(Boolean);
    return Array.from(new Set(fechas)).sort();
  }

  private syncDisponibilidadDiariaPorFechas(): void {
    const fechas = Array.from(new Set(this.fechasTrabajoValores));
    fechas.forEach((fecha) => this.cargarDisponibilidadDiaria(fecha));
  }

  private cargarDisponibilidadDiaria(fecha: string): void {
    const key = (fecha ?? '').toString().trim();
    if (!key) return;
    if (this.disponibilidadDiariaPorFecha[key] || this.disponibilidadDiariaLoadingPorFecha[key]) {
      return;
    }
    this.disponibilidadDiariaLoadingPorFecha[key] = true;
    this.cotizacionService
      .getPedidoDisponibilidadDiaria(key)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          delete this.disponibilidadDiariaLoadingPorFecha[key];
          this.disponibilidadDiariaLoadingPorFecha = { ...this.disponibilidadDiariaLoadingPorFecha };
        }),
      )
      .subscribe({
        next: (data) => {
          this.disponibilidadDiariaPorFecha = {
            ...this.disponibilidadDiariaPorFecha,
            [key]: data,
          };
        },
        error: (err) => {
          console.error('[cotizacion] disponibilidad diaria', err);
        },
      });
  }

  private autoAsignarFechasSiCantidadMaxima(
    itemTmpId: string,
    cantidad: number,
  ): void {
    if (!this.isMultipleDias()) return;
    const max = this.getCantidadMaximaPorDias();
    if (!max || cantidad < max) return;
    const fechasBase = this.getFechasProgramacionUnicas().length
      ? this.getFechasProgramacionUnicas()
      : ((this.form.get('fechaEvento')?.value ?? '').toString().trim()
          ? [String(this.form.get('fechaEvento')?.value).trim()]
          : []);
    if (!fechasBase.length) return;
    const fechasObjetivo = fechasBase.slice(0, cantidad);
    this.serviciosFechasSeleccionadas = [
      ...this.serviciosFechasSeleccionadas.filter(
        (entry) => entry.itemTmpId !== itemTmpId,
      ),
      ...fechasObjetivo.map((fecha) => ({ itemTmpId, fecha })),
    ];
  }

  private getFechaProgramacionNuevaFila(preferida?: string): string {
    const directa = (preferida ?? '').toString().trim();
    if (directa) {
      return directa;
    }
    const fechasTrabajo = this.fechasTrabajoValores;
    if (fechasTrabajo.length) {
      return fechasTrabajo[0];
    }
    const fechaEvento = (this.form.get('fechaEvento')?.value ?? '')
      .toString()
      .trim();
    return (
      fechaEvento || RegistrarCotizacionComponent.computeFechaMinimaEvento()
    );
  }

  private getFechasTrabajoRaw(): string[] {
    return this.fechasTrabajo.controls.map((control) =>
      (control.value ?? '').toString().trim(),
    );
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
      control.setValue((values[index] ?? '').toString().trim(), {
        emitEvent: false,
      });
    });
    this.fechasTrabajoSnapshot = this.getFechasTrabajoRaw();
    this.syncFechaEventoDesdeFechasTrabajo();
  }

  private moverDiasAlFinal(indices: number[]): void {
    const values = this.getFechasTrabajoRaw();
    const validos = Array.from(new Set(indices))
      .filter(
        (index) =>
          Number.isInteger(index) && index >= 0 && index < values.length,
      )
      .sort((a, b) => a - b);
    if (!validos.length) {
      return;
    }
    const removidos = validos.map((index) => values[index] ?? '');
    const restantes = values.filter((_, index) => !validos.includes(index));
    this.setFechasTrabajoRaw([...restantes, ...removidos]);
  }

  private async seleccionarDiasAEliminar(
    anterior: number,
    nuevo: number,
  ): Promise<number[] | null> {
    const values = this.getFechasTrabajoRaw();
    const cantidadAEliminar = anterior - nuevo;
    if (cantidadAEliminar <= 0 || values.length <= nuevo) {
      return [];
    }
    const opcionesHtml = values
      .map((fecha, index) => {
        const fechaLabel = fecha ? this.formatFechaConDia(fecha) : 'Sin fecha';
        const locaciones = fecha
          ? this.getProgramacionIndicesPorFecha(fecha).length
          : 0;
        const checked = index >= nuevo ? 'checked' : '';
        const estado =
          locaciones > 0 ? `${locaciones} locaciones` : 'Sin locaciones';
        return `
        <label class="d-flex align-items-center gap-2 mb-2 p-2 border rounded">
          <input type="checkbox" class="swal2-day-checkbox" value="${index}" ${checked}>
          <span><b>Dia ${index + 1}</b> - ${fechaLabel}<br><small class="text-muted">${estado}</small></span>
        </label>
      `;
      })
      .join('');
    const result = await this.fireSwal({
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
        const selected = Array.from(
          document.querySelectorAll<HTMLInputElement>(
            '.swal2-day-checkbox:checked',
          ),
        )
          .map((node) => Number(node.value))
          .filter(Number.isFinite);
        if (selected.length !== cantidadAEliminar) {
          Swal.showValidationMessage(
            `Selecciona exactamente ${cantidadAEliminar} dia(s).`,
          );
          return null;
        }
        return selected;
      },
    });
    return result.isConfirmed
      ? ((result.value as number[] | null) ?? [])
      : null;
  }

  private hasLocacionesRegistradas(): boolean {
    return this.programacion.controls.some((control) => {
      const raw = (control as UntypedFormGroup).getRawValue() as Record<
        string,
        unknown
      >;
      const nombre = (raw['nombre'] ?? '').toString().trim();
      const direccion = (raw['direccion'] ?? '').toString().trim();
      const hora = (raw['hora'] ?? '').toString().trim();
      const notas = (raw['notas'] ?? '').toString().trim();
      return !!nombre || !!direccion || !!hora || !!notas;
    });
  }

  private remapFechaLocacionesYAsignaciones(
    fechaAnterior: string,
    fechaNueva: string,
  ): void {
    const from = (fechaAnterior ?? '').toString().trim();
    const to = (fechaNueva ?? '').toString().trim();
    if (!from || !to || from === to) {
      return;
    }
    this.programacion.controls.forEach((control) => {
      const fechaControl = (control as UntypedFormGroup).get('fecha');
      if ((fechaControl?.value ?? '').toString().trim() === from) {
        fechaControl?.setValue(to, { emitEvent: false });
      }
    });
    if (this.serviciosFechasSeleccionadas.length) {
      this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.map(
        (entry) =>
          (entry.fecha ?? '').toString().trim() === from
            ? { ...entry, fecha: to }
            : entry,
      );
    }
  }

  private syncFechasTrabajoPorDias(value: unknown): void {
    const dias = this.parseNumber(value);
    const target =
      dias != null && dias >= 1 ? Math.min(Math.floor(dias), 7) : 0;
    const prev = [...this.fechasTrabajoSnapshot];
    const prevLength = prev.length;
    while (this.fechasTrabajo.length < target) {
      const control = this.fb.control('', [
        Validators.required,
        this.fechaEventoEnRangoValidator(),
      ]);
      this.fechasTrabajo.push(control);
    }
    while (this.fechasTrabajo.length > target) {
      this.fechasTrabajo.removeAt(this.fechasTrabajo.length - 1);
    }
    this.fechasTrabajo.controls.forEach((control) => {
      control.setValidators([
        Validators.required,
        this.fechaEventoEnRangoValidator(),
      ]);
      control.updateValueAndValidity({ emitEvent: false });
    });
    const next = this.getFechasTrabajoRaw();
    const isExpansion = target > prevLength;
    if (!isExpansion) {
      this.remapProgramacionFechas(prev, next);
    }
    this.fechasTrabajoSnapshot = next;
    this.syncFechaEventoDesdeFechasTrabajo();
  }

  private sugerirFechaTrabajo(index: number): string {
    const base = this.parseDateOrMin(this.form.get('fechaEvento')?.value);
    const sug = new Date(base);
    sug.setDate(sug.getDate() + index);
    return RegistrarCotizacionComponent.formatIsoDate(sug);
  }

  private parseDateOrMin(value: unknown): Date {
    const parsed = parseDateInput(
      (value ?? '') as string | number | Date | null | undefined,
    );
    const min = parseDateInput(this.fechaMinimaEvento);
    return parsed ?? min ?? new Date();
  }

  private remapProgramacionFechas(prev: string[], next: string[]): void {
    const nextNoVacias = next.map((item) => item.trim()).filter(Boolean);
    if (!nextNoVacias.length) {
      this.programacion.controls.forEach((control) => {
        (control as UntypedFormGroup)
          .get('fecha')
          ?.setValue('', { emitEvent: false });
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
      this.programacion.controls.forEach((control) => {
        const fechaControl = (control as UntypedFormGroup).get('fecha');
        if ((fechaControl?.value ?? '').toString().trim() === oldFecha) {
          fechaControl?.setValue(newFecha, { emitEvent: false });
        }
      });
    }
    const fallback = nextNoVacias[0];
    this.programacion.controls.forEach((control) => {
      const fechaControl = (control as UntypedFormGroup).get('fecha');
      const fechaActual = (fechaControl?.value ?? '').toString().trim();
      if (!fechaActual || !nextNoVacias.includes(fechaActual)) {
        fechaControl?.setValue(fallback, { emitEvent: false });
      }
    });
  }

  private syncFechaEventoDesdeFechasTrabajo(): void {
    const primera = this.fechasTrabajoValores[0] ?? '';
    this.form
      .get('fechaEvento')
      ?.setValue(primera || null, { emitEvent: false });
    this.syncDisponibilidadDiariaPorFechas();
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
      year: 'numeric',
    }).format(parsed);
    return base.replace(/ de (\d{4})$/, ' del $1');
  }

  getDisponibilidadDiaria(fecha: string): PedidoDisponibilidadDiariaResponse | null {
    const key = (fecha ?? '').toString().trim();
    if (!key) return null;
    return this.disponibilidadDiariaPorFecha[key] ?? null;
  }

  getDisponibilidadEstadoLabel(fecha: string): string {
    const data = this.getDisponibilidadDiaria(fecha);
    if (!data) {
      return this.disponibilidadDiariaLoadingPorFecha[fecha]
        ? 'Disponibilidad: consultando'
        : 'Disponibilidad: sin datos';
    }
    const nivel = this.getDisponibilidadNivel(fecha);
    if (nivel === 'CRITICA') return 'Disponibilidad: crítica';
    if (nivel === 'LIMITADA') return 'Disponibilidad: limitada';
    if (nivel === 'ALTA') return 'Disponibilidad: alta';
    return 'Disponibilidad: sin datos';
  }

  isEventoSeleccionado(): boolean {
    return this.selectedEventoId != null;
  }

  canContinueFlow(): boolean {
    if (!this.isEventoSeleccionado()) {
      return false;
    }
    const dias = this.parseNumber(this.form.get('dias')?.value);
    return dias != null && dias >= 1;
  }

  private applyEventoGateRules(): void {
    const eventoSeleccionado = this.isEventoSeleccionado();
    const departamentoControl = this.form.get('departamento');
    const diasControl = this.form.get('dias');
    const horasControl = this.form.get('horasEstimadas');

    if (departamentoControl) {
      if (eventoSeleccionado && departamentoControl.disabled) {
        departamentoControl.enable({ emitEvent: false });
      }
      if (!eventoSeleccionado && departamentoControl.enabled) {
        departamentoControl.disable({ emitEvent: false });
      }
    }

    if (diasControl) {
      if (eventoSeleccionado && diasControl.disabled) {
        diasControl.enable({ emitEvent: false });
      }
      if (!eventoSeleccionado && diasControl.enabled) {
        diasControl.disable({ emitEvent: false });
      }
    }

    if (!eventoSeleccionado) {
      if (horasControl?.enabled) {
        horasControl.disable({ emitEvent: false });
      }
      return;
    }

    this.applyDiasRules(this.form.get('dias')?.value);
  }

  getDisponibilidadPersonalDisponibleLabel(fecha: string): string {
    const data = this.getDisponibilidadDiaria(fecha);
    if (!data) {
      return this.disponibilidadDiariaLoadingPorFecha[fecha]
        ? 'Personal: consultando'
        : 'Personal: sin datos';
    }
    return `Personal disponible: ${this.normalizeDisponibles(data.resumen.personal.disponible)}`;
  }

  getDisponibilidadEquiposDisponibleLabel(fecha: string): string {
    const data = this.getDisponibilidadDiaria(fecha);
    if (!data) {
      return this.disponibilidadDiariaLoadingPorFecha[fecha]
        ? 'Equipos: consultando'
        : 'Equipos: sin datos';
    }
    return `Equipos disponibles: ${this.normalizeDisponibles(data.resumen.equipos.disponible)}`;
  }

  getDisponibilidadPersonalPorRolOrdenado(fecha: string): {
    rolId: number;
    rolNombre: string;
    disponible: number;
    disponibleInterno: number;
    disponibleFreelance: number;
  }[] {
    const rows = this.getDisponibilidadDiaria(fecha)?.personalPorRol ?? [];
    return rows
      .map((row) => ({
        rolId: row.rolId,
        rolNombre: row.rolNombre,
        disponible: this.normalizeDisponibles(row.disponible),
        disponibleInterno: this.normalizeDisponibles(row.interno?.disponible),
        disponibleFreelance: this.normalizeDisponibles(row.freelance?.disponible),
      }))
      .sort((a, b) => a.disponible - b.disponible || a.rolNombre.localeCompare(b.rolNombre));
  }

  getDisponibilidadPersonalInternoPorRolOrdenado(fecha: string): {
    rolId: number;
    rolNombre: string;
    disponible: number;
  }[] {
    const rows = this.getDisponibilidadDiaria(fecha)?.personalPorRol ?? [];
    return rows
      .map((row) => ({
        rolId: row.rolId,
        rolNombre: row.rolNombre,
        disponible: this.normalizeDisponibles(row.interno?.disponible),
      }))
      .sort((a, b) => a.disponible - b.disponible || a.rolNombre.localeCompare(b.rolNombre));
  }

  getDisponibilidadPersonalFreelancePorRolOrdenado(fecha: string): {
    rolId: number;
    rolNombre: string;
    disponible: number;
  }[] {
    const rows = this.getDisponibilidadDiaria(fecha)?.personalPorRol ?? [];
    return rows
      .map((row) => ({
        rolId: row.rolId,
        rolNombre: row.rolNombre,
        disponible: this.normalizeDisponibles(row.freelance?.disponible),
      }))
      .sort((a, b) => a.disponible - b.disponible || a.rolNombre.localeCompare(b.rolNombre));
  }

  getDisponibilidadEquiposPorTipoOrdenado(fecha: string): {
    tipoEquipoId: number;
    tipoEquipoNombre: string;
    disponible: number;
  }[] {
    const rows = this.getDisponibilidadDiaria(fecha)?.equiposPorTipo ?? [];
    return rows
      .map((row) => ({
        tipoEquipoId: row.tipoEquipoId,
        tipoEquipoNombre: row.tipoEquipoNombre,
        disponible: this.normalizeDisponibles(row.disponible),
      }))
      .sort((a, b) => a.disponible - b.disponible || a.tipoEquipoNombre.localeCompare(b.tipoEquipoNombre));
  }

  getDisponibilidadEstadoClass(fecha: string): string {
    const data = this.getDisponibilidadDiaria(fecha);
    if (!data) return 'programacion-dispo--none';
    const nivel = this.getDisponibilidadNivel(fecha);
    if (nivel === 'CRITICA') return 'programacion-dispo--critical';
    if (nivel === 'LIMITADA') return 'programacion-dispo--warn';
    if (nivel === 'ALTA') return 'programacion-dispo--ok';
    return 'programacion-dispo--none';
  }

  hasDisponibilidadDetalle(fecha: string): boolean {
    const data = this.getDisponibilidadDiaria(fecha);
    return !!(
      data?.personalPorRol?.length ||
      data?.equiposPorTipo?.length ||
      data?.disponibilidadDia?.requiereApoyoExterno
    );
  }

  getDisponibilidadRequiereApoyoExterno(fecha: string): boolean {
    return !!this.getDisponibilidadDiaria(fecha)?.disponibilidadDia?.requiereApoyoExterno;
  }

  private getDisponibilidadNivel(fecha: string): string | null {
    const raw = this.getDisponibilidadDiaria(fecha)?.disponibilidadDia?.nivel;
    if (!raw) return null;
    const nivel = String(raw).trim().toUpperCase();
    if (nivel === 'ALTA' || nivel === 'LIMITADA' || nivel === 'CRITICA') {
      return nivel;
    }
    return null;
  }

  private normalizeDisponibles(value: unknown): number {
    const parsed = this.parseNumber(value);
    if (parsed == null) {
      return 0;
    }
    return Math.max(0, parsed);
  }

  shouldShowFechaEvento(): boolean {
    const value = this.form.get('dias')?.value;
    const parsed = this.parseNumber(value);
    return parsed != null && parsed <= 1;
  }

  private applyDiasRules(value: unknown): void {
    const diasControl = this.form.get('dias');
    const parsedRaw = this.parseNumber(value);
    const parsed =
      parsedRaw != null && parsedRaw >= 1
        ? Math.min(Math.floor(parsedRaw), 7)
        : parsedRaw;
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

    this.programacion.controls.forEach((control) => {
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

    if (
      !multiple &&
      this.selectedPaquetes.some((item) => (item.cantidad ?? 1) !== 1)
    ) {
      this.selectedPaquetes = this.selectedPaquetes.map((item) => ({
        ...item,
        cantidad: 1,
      }));
      this.syncTotalEstimado();
    }
    if (multiple) {
      const max = this.getCantidadMaximaPorDias();
      if (max != null) {
        const ajustados = this.selectedPaquetes.map((item) => ({
          ...item,
          cantidad: Math.min(Number(item.cantidad ?? 1) || 1, max),
        }));
        const changed = ajustados.some(
          (item, index) =>
            item.cantidad !== this.selectedPaquetes[index]?.cantidad,
        );
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

  private onDiasChange(value: unknown): void {
    if (this.diasChangeGuard) {
      return;
    }
    const diasControl = this.form.get('dias');
    const nuevo = this.normalizeDias(value);
    const anterior =
      this.lastDiasAplicado > 0
        ? this.lastDiasAplicado
        : this.fechasTrabajo.length;
    const valorControl = this.parseNumber(diasControl?.value);

    if (diasControl && valorControl !== nuevo) {
      this.diasChangeGuard = true;
      diasControl.setValue(nuevo || null, { emitEvent: false });
      diasControl.updateValueAndValidity({ emitEvent: false });
      this.diasChangeGuard = false;
    }

    if (anterior > 0 && nuevo > 0 && nuevo < anterior) {
      const impacto = this.getImpactoReduccionDias(nuevo);
      if (impacto.total <= 0) {
        this.aplicarReduccionDias(nuevo);
        this.applyDiasRules(nuevo);
        this.lastDiasAplicado = nuevo;
        return;
      }
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

  private normalizeDias(value: unknown): number {
    const parsed = this.parseNumber(value);
    if (parsed == null || parsed < 1) {
      return 0;
    }
    return Math.min(Math.floor(parsed), 7);
  }

  private getImpactoReduccionDias(nuevoDias: number): {
    total: number;
    fechas: number;
    locaciones: number;
    asignaciones: number;
  } {
    const fechasActuales = this.getFechasTrabajoRaw();
    const fechasPermitidas = new Set(
      fechasActuales.slice(0, nuevoDias).filter(Boolean),
    );
    const fechasEliminadas = fechasActuales.slice(nuevoDias).filter(Boolean);

    const locacionesEliminadas = this.programacion.controls.filter(
      (control) => {
        const fecha = ((control as UntypedFormGroup).get('fecha')?.value ?? '')
          .toString()
          .trim();
        return !!fecha && !fechasPermitidas.has(fecha);
      },
    ).length;

    const asignacionesEliminadas = this.serviciosFechasSeleccionadas.filter(
      (entry) => !fechasPermitidas.has((entry.fecha ?? '').toString().trim()),
    ).length;

    const total =
      fechasEliminadas.length + locacionesEliminadas + asignacionesEliminadas;
    return {
      total,
      fechas: fechasEliminadas.length,
      locaciones: locacionesEliminadas,
      asignaciones: asignacionesEliminadas,
    };
  }

  private aplicarReduccionDias(nuevoDias: number): void {
    const fechasActuales = this.getFechasTrabajoRaw();
    const fechasPermitidas = new Set(
      fechasActuales.slice(0, nuevoDias).filter(Boolean),
    );

    for (let i = this.programacion.length - 1; i >= 0; i -= 1) {
      const grupo = this.programacion.at(i) as UntypedFormGroup;
      const fecha = (grupo.get('fecha')?.value ?? '').toString().trim();
      if (fecha && !fechasPermitidas.has(fecha)) {
        this.programacion.removeAt(i);
      }
    }

    this.serviciosFechasSeleccionadas =
      this.serviciosFechasSeleccionadas.filter((entry) =>
        fechasPermitidas.has((entry.fecha ?? '').toString().trim()),
      );
  }

  isDepartamentoLima(): boolean {
    const depto = (this.form.get('departamento')?.value ?? '')
      .toString()
      .trim()
      .toLowerCase();
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
    const avisoMonto =
      monto != null && monto > 0
        ? 'El monto de viaticos podria variar si cambias de departamento.'
        : '';
    const texto = avisoMonto
      ? `¿Seguro que deseas cambiar el departamento de "${prev}" a "${next}"? ${avisoMonto}`
      : `¿Seguro que deseas cambiar el departamento de "${prev}" a "${next}"?`;

    void this.fireSwal({
      icon: 'warning',
      title: 'Cambiar departamento',
      text: texto,
      showCancelButton: true,
      confirmButtonText: 'Cambiar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (result.isConfirmed) {
        this.lastDepartamento = next;
        this.applyViaticosRules();
        return;
      }
      this.departamentoChangeLock = true;
      this.form.get('departamento')?.setValue(prev, { emitEvent: false });
      this.departamentoChangeLock = false;
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

  private splitHoraTo12(value: string): {
    hora12: number | null;
    minuto: string | null;
    ampm: 'AM' | 'PM' | null;
  } {
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

  private toHora24(
    hora12Value: unknown,
    minutoValue: unknown,
    ampmValue: unknown,
  ): string {
    const hora12 = Number(hora12Value);
    const minuto =
      typeof minutoValue === 'string' ? minutoValue : `${minutoValue ?? ''}`;
    const ampm = ampmValue === 'PM' || ampmValue === 'AM' ? ampmValue : '';
    if (
      !Number.isFinite(hora12) ||
      hora12 < 1 ||
      hora12 > 12 ||
      minuto.length !== 2 ||
      !ampm
    ) {
      return '';
    }
    let horas24 = hora12 % 12;
    if (ampm === 'PM') {
      horas24 += 12;
    }
    return `${String(horas24).padStart(2, '0')}:${minuto}`;
  }

  private horaToMinutos(value: string): number {
    const hora = this.normalizeHora24(value);
    const match = /^(\d{2}):(\d{2})$/.exec(hora);
    if (!match) {
      return Number.MAX_SAFE_INTEGER;
    }
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return h * 60 + m;
  }

  private formatHoraTexto(hora24: string): string {
    const parts = this.splitHoraTo12(hora24);
    if (!parts.hora12 || !parts.minuto || !parts.ampm) {
      return hora24;
    }
    return `${parts.hora12}:${parts.minuto} ${parts.ampm}`;
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
    void this.fireSwal({
      icon,
      title,
      text,
      confirmButtonText: 'Entendido',
    });
  }

  private showAlertHtml(icon: AlertIcon, title: string, html: string): void {
    void this.fireSwal({
      icon,
      title,
      html,
      confirmButtonText: 'Entendido',
    });
  }

  private validarRestriccionesProgramacion(
    diasNumero: number | null,
  ): string[] {
    const errores: string[] = [];
    const fechasTrabajo = this.fechasTrabajoValores;
    const diasEsperados =
      diasNumero != null && diasNumero >= 1
        ? Math.min(Math.floor(diasNumero), 7)
        : 0;

    if (diasEsperados > 0 && fechasTrabajo.length !== diasEsperados) {
      errores.push(`Debes registrar ${diasEsperados} fecha(s) de trabajo.`);
      return errores;
    }

    const fechasUnicas = new Set(fechasTrabajo);
    if (fechasUnicas.size !== fechasTrabajo.length) {
      errores.push('Las fechas de trabajo no pueden repetirse.');
    }

    const ordenadas = [...fechasTrabajo].sort();
    const desordenadas = fechasTrabajo.some(
      (fecha, index) => fecha !== ordenadas[index],
    );
    if (desordenadas) {
      errores.push(
        'Ordena las fechas de trabajo cronológicamente (de la mas próxima a la mas lejana).',
      );
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

      indices.forEach((index) => {
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
        errores.push(
          `"${fechaLabel}": tienes ${incompletas} locación(es) con datos incompletos.`,
        );
      }

      const duplicadas = Array.from(locacionKeyConteo.values()).some(
        (total) => total > 1,
      );
      if (duplicadas) {
        errores.push(
          `"${fechaLabel}": hay locaciones duplicadas (misma locación, dirección y hora).`,
        );
      }
    }

    return errores;
  }

  private showToast(
    icon: AlertIcon,
    title: string,
    text?: string,
    timer = 2200,
  ): void {
    void this.fireSwal({
      icon,
      title,
      text,
      toast: true,
      position: 'top-end',
      timer,
      timerProgressBar: true,
      showConfirmButton: false,
    });
  }

  private loadCatalogos(): void {
    this.loadingCatalogos = true;

    this.cotizacionService
      .getServicios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (servicios) => {
          this.servicios = Array.isArray(servicios) ? servicios : [];
          if (!this.servicios.length) {
            this.selectedServicioId = null;
            this.selectedServicioNombre = '';
          } else if (this.selectedServicioId == null) {
            const firstValido =
              this.servicios.find((item) => this.getId(item) != null) || null;
            if (firstValido) {
              const id = this.getId(firstValido)!;
              this.selectedServicioId = id;
              this.selectedServicioNombre = this.getServicioNombre(firstValido);
            }
          }
          this.loadingCatalogos = false;
          this.loadEventosServicio();
          this.syncProgramacionFechas();
        },
        error: (err) => {
          console.error('[cotizacion] servicios', err);
          this.servicios = [];
          this.selectedServicioId = null;
          this.selectedServicioNombre = '';
          this.loadingCatalogos = false;
          this.loadEventosServicio();
          this.syncProgramacionFechas();
        },
      });

    this.cotizacionService
      .getEventos(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (eventos) => {
          this.eventos = Array.isArray(eventos) ? eventos : [];
          if (!this.eventos.length) {
            this.selectedEventoId = null;
            this.selectedEventoNombre = '';
            this.selectedEventoDetalle = null;
            this.syncDatosEventoControls();
          } else if (this.selectedEventoId != null) {
            const selected = this.eventos.find(
              (e) => this.getId(e) === this.selectedEventoId,
            );
            this.selectedEventoNombre = this.getEventoNombre(selected);
            this.cargarEventoSeleccionado(this.selectedEventoId);
          }
          this.loadEventosServicio();
        },
        error: (err) => {
          console.error('[cotizacion] eventos', err);
          this.eventos = [];
          this.selectedEventoId = null;
          this.selectedEventoNombre = '';
          this.selectedEventoDetalle = null;
          this.syncDatosEventoControls();
          this.loadEventosServicio();
        },
      });
  }

  private cargarEventoSeleccionado(eventoId: number): void {
    this.cotizacionService
      .getEventoById(eventoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (evento) => {
          this.selectedEventoDetalle = this.asRecord(evento);
          const nombre = this.getNombre(evento);
          if (nombre) {
            this.selectedEventoNombre = nombre;
          }
          this.syncDatosEventoControls();
        },
        error: (err) => {
          console.error('[cotizacion] eventoById', err);
          this.selectedEventoDetalle = null;
          this.syncDatosEventoControls();
        },
      });
  }

  private loadEventosServicio(): void {
    if (this.selectedEventoId == null || this.selectedServicioId == null) {
      this.paquetesRows = [];
      this.loadingPaquetes = false;
      return;
    }

    this.loadingPaquetes = true;
    this.cotizacionService
      .getEventosServicio(this.selectedEventoId, this.selectedServicioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (paquetes) => {
          const activos = Array.isArray(paquetes)
            ? paquetes.filter((item) => {
                const record = this.asRecord(item);
                const estado = this.asRecord(record['estado']);
                const estadoNombre = String(
                  estado['nombre'] ?? record['estadoNombre'] ?? '',
                ).toLowerCase();
                const estadoId = this.parseNumber(
                  estado['id'] ?? estado['idEstado'] ?? record['estadoId'],
                );
                return estadoNombre !== 'inactivo' && estadoId !== 2;
              })
            : [];
          this.paquetesRows = activos.map((item) =>
            this.normalizePaqueteRow(item),
          );
          this.loadingPaquetes = false;
        },
        error: (err) => {
          console.error('[cotizacion] eventos-servicio', err);
          this.paquetesRows = [];
          this.loadingPaquetes = false;
        },
      });
  }

  syncTotalEstimado(): void {
    const control = this.form.get('totalEstimado');
    control?.setValue(this.totalSeleccion, { emitEvent: false });
    this.refreshSelectedPaquetesColumns();
  }

  private getServicioNombre(item: unknown): string {
    return this.getNombre(item);
  }

  private getEventoNombre(item: unknown): string {
    return this.getNombre(item);
  }

  private static getTodayIsoDate(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  }
  private static computeFechaMinimaEvento(): string {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return RegistrarCotizacionComponent.formatIsoDate(date);
  }

  private static computeFechaMaximaEvento(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 6);
    return RegistrarCotizacionComponent.formatIsoDate(date);
  }

  private static formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private fechaEventoEnRangoValidator(): ValidatorFn {
    return (control) => {
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

  private getId(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['id']);
  }

  private getPkgKey(el: unknown): string {
    const eventoServicioId = this.getEventoServicioId(el);
    return eventoServicioId != null ? String(eventoServicioId) : '';
  }

  private getEventoServicioId(item: unknown): number | null {
    const record = this.asRecord(item);
    if (!Object.keys(record).length) {
      return null;
    }
    const eventoServicio = this.asRecord(record['eventoServicio']);
    const num = this.parseNumber(
      record['eventoServicioId'] ??
        record['idEventoServicio'] ??
        eventoServicio['id'] ??
        record['id'],
    );
    return num != null && num > 0 ? num : null;
  }

  private getHoras(item: unknown): number | null {
    const record = this.asRecord(item);
    return this.parseNumber(record['horas']);
  }

  private getStaff(item: unknown): number | null {
    const record = this.asRecord(item);
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

  private getPaqueteServicioId(item: unknown): number | null {
    const record = this.asRecord(item);
    if (!Object.keys(record).length) {
      return this.selectedServicioId;
    }
    const servicio = this.asRecord(record['servicio']);
    const parsed = this.parseNumber(servicio['id'] ?? record['servicioId']);
    if (parsed != null) {
      return parsed;
    }
    return this.selectedServicioId;
  }

  private getPaqueteServicioNombre(item: unknown): string | undefined {
    const record = this.asRecord(item);
    const servicio = this.asRecord(record['servicio']);
    const baseNombre = servicio['nombre'] ?? record['servicioNombre'];
    if (baseNombre) {
      const texto = String(baseNombre).trim();
      if (texto) return texto;
    }
    return this.selectedServicioNombre || undefined;
  }

  private deriveGrupo(): string | null {
    if (this.selectedServicioNombre) {
      return this.selectedServicioNombre.toUpperCase();
    }
    if (this.selectedEventoNombre) {
      return this.selectedEventoNombre.toUpperCase();
    }
    return null;
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

  private normalizePaqueteRow(item: unknown): PaqueteRow {
    const record = this.asRecord(item);
    const precio = this.parseNumber(record['precio']);
    const staffRecord = this.asRecord(record['staff']);
    const staffTotal = this.parseNumber(
      staffRecord['total'] ?? record['staff'],
    );
    const staff = staffTotal ?? this.getStaff(record);
    const horas =
      this.getHoras(record) ??
      this.parseHorasToNumber(
        String(record['horasTexto'] ?? record['HorasTexto'] ?? ''),
      );
    return {
      titulo: this.getTitulo(record),
      descripcion: this.getDescripcion(record),
      precio: precio != null ? precio : null,
      staff: staff != null ? staff : null,
      horas: horas != null ? horas : null,
      raw: record,
    };
  }

  private parseHorasToNumber(
    value: string | null | undefined,
  ): number | undefined {
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

  getSchemaControlInvalid(field: EventoSchemaCampo): boolean {
    const control = this.datosEventoGroup.get(field.key);
    return !!control && control.invalid && control.touched;
  }

  getSchemaErrorMessage(field: EventoSchemaCampo): string {
    const control = this.datosEventoGroup.get(field.key);
    if (!control?.errors) {
      return '';
    }
    if (field.type === 'checkbox' && control.hasError('required')) {
      return 'Debes marcar esta opción.';
    }
    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }
    return 'Valor invalido.';
  }

  private buildDatosEventoPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of this.eventoFormSchema) {
      const control = this.datosEventoGroup.get(field.key);
      if (!control) {
        continue;
      }
      const rawValue = control.value;
      if (field.type === 'checkbox') {
        payload[field.key] = Boolean(rawValue);
        continue;
      }
      if (field.type === 'number') {
        const parsed = this.parseNumber(rawValue);
        if (parsed != null) {
          payload[field.key] = parsed;
        }
        continue;
      }
      const text = (rawValue ?? '').toString().trim();
      if (text) {
        payload[field.key] = text;
      }
    }
    return payload;
  }

  private syncDatosEventoControls(): void {
    const group = this.datosEventoGroup;
    const schema = this.eventoFormSchema;
    const allowedKeys = new Set(schema.map((field) => field.key));

    Object.keys(group.controls).forEach((key) => {
      if (!allowedKeys.has(key)) {
        group.removeControl(key);
      }
    });

    schema.forEach((field) => {
      const validators = this.buildSchemaValidators(field);
      const existing = group.get(field.key);
      if (existing) {
        existing.setValidators(validators);
        existing.updateValueAndValidity({ emitEvent: false });
        return;
      }
      const initialValue = field.type === 'checkbox' ? false : '';
      group.addControl(field.key, this.fb.control(initialValue, validators));
    });
  }

  private buildSchemaValidators(field: EventoSchemaCampo): ValidatorFn[] {
    if (!field.required) {
      return [];
    }
    if (field.type === 'checkbox') {
      return [Validators.requiredTrue];
    }
    return [Validators.required];
  }

  private normalizeEventoSchemaCampo(
    item: unknown,
    index: number,
  ): EventoSchemaCampo | null {
    const record = this.asRecord(item);
    const key = (record['key'] ?? '').toString().trim();
    const label = (record['label'] ?? '').toString().trim();
    const typeRaw = (record['type'] ?? '').toString().trim().toLowerCase();
    const type = this.asEventoCampoTipo(typeRaw);
    const order = this.parseNumber(record['order']) ?? index + 1;
    const active = record['active'] !== false;
    const required = record['required'] === true;
    const options = Array.isArray(record['options'])
      ? (record['options'] as unknown[])
          .map((opt) => String(opt ?? '').trim())
          .filter(Boolean)
      : [];
    if (!key || !label || !type) {
      return null;
    }
    if (type === 'select' && !options.length) {
      return null;
    }
    return {
      key,
      label,
      type,
      required,
      active,
      order: order > 0 ? order : index + 1,
      options,
    };
  }

  private asEventoCampoTipo(value: string): EventoCampoTipo | null {
    if (
      value === 'text' ||
      value === 'textarea' ||
      value === 'number' ||
      value === 'date' ||
      value === 'select' ||
      value === 'checkbox'
    ) {
      return value;
    }
    return null;
  }

  private normalizarClave(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private setProgramacionExpandida(
    grupo: UntypedFormGroup,
    expandida: boolean,
  ): void {
    this.programacionExpandida.set(grupo, expandida);
  }

  private expandirProgramacionConErrores(): void {
    this.programacion.controls.forEach((control) => {
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

  private focusPrecioInput(key: string | number): void {
    setTimeout(() => {
      const element = document.getElementById(
        this.getPrecioInputIdFromKey(key),
      ) as HTMLInputElement | null;
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
      {
        key: 'precioUnit',
        header: 'Precio unit.',
        sortable: false,
        class: 'text-center',
        width: '140px',
      },
    ];

    if (this.isMultipleDias()) {
      base.splice(1, 0, {
        key: 'cantidad',
        header: 'Dias',
        sortable: false,
        class: 'text-center',
        width: '90px',
      });
    }

    if (this.shouldShowPrecioOriginal()) {
      base.push({
        key: 'precioOriginal',
        header: 'Original',
        sortable: false,
        class: 'text-center',
        width: '140px',
      });
    }

    base.push(
      {
        key: 'horas',
        header: 'Horas',
        sortable: false,
        class: 'text-center',
        width: '100px',
      },
      {
        key: 'staff',
        header: 'Staff',
        sortable: false,
        class: 'text-center',
        width: '110px',
      },
      {
        key: 'subtotal',
        header: 'Subtotal',
        sortable: false,
        class: 'text-center',
        width: '140px',
      },
      {
        key: 'notas',
        header: 'Notas',
        sortable: false,
        filterable: false,
        width: '280px',
      },
      {
        key: 'quitar',
        header: 'Quitar',
        sortable: false,
        filterable: false,
        class: 'text-center',
        width: '90px',
      },
    );

    this.selectedPaquetesColumns = base;
  }

  private resetFormState(): void {
    this.form.reset(
      {
        clienteNombre: '',
        clienteContacto: '',
        fechaEvento: RegistrarCotizacionComponent.computeFechaMinimaEvento(),
        dias: null,
        departamento: 'Lima',
        viaticosCliente: true,
        viaticosMonto: null,
        horasEstimadas: '',
        descripcion: '',
        totalEstimado: 0,
      },
      { emitEvent: false },
    );

    const horasControl = this.form.get('horasEstimadas');
    if (horasControl) {
      horasControl.disable({ emitEvent: false });
    }
    const totalControl = this.form.get('totalEstimado');
    if (totalControl && !totalControl.disabled) {
      totalControl.disable({ emitEvent: false });
    }
    const montoControl = this.form.get('viaticosMonto');
    if (montoControl) {
      montoControl.disable({ emitEvent: false });
    }
    this.applyViaticosRules();

    while (this.programacion.length) {
      this.programacion.removeAt(0);
    }
    while (this.fechasTrabajo.length) {
      this.fechasTrabajo.removeAt(0);
    }

    this.selectedPaquetes = [];
    this.tmpIdSequence = 0;
    this.paquetesRows = [];
    this.selectedEventoId = null;
    this.selectedEventoNombre = '';
    this.selectedEventoDetalle = null;
    this.selectedServicioId = null;
    this.selectedServicioNombre = '';
    this.clienteSeleccionado = null;
    this.clienteResultados = [];
    this.clienteBusquedaTermino = '';
    this.eventoSelectTouched = false;
    this.asignacionFechasAbierta = false;
    this.fechasDisponibles = [];
    this.serviciosFechasSeleccionadas = [];
    this.disponibilidadDiariaPorFecha = {};
    this.disponibilidadDiariaLoadingPorFecha = {};
    this.fechasTrabajoSnapshot = [];
    this.lastDiasAplicado = 0;
    this.diasChangeGuard = false;
    this.programacionExpandida = new WeakMap<UntypedFormGroup, boolean>();
    this.syncDatosEventoControls();
    this.syncTotalEstimado();
  }

  private fireSwal(options: Parameters<typeof Swal.fire>[0]): ReturnType<typeof Swal.fire> {
    const customClass = (options as { customClass?: Record<string, string> })?.customClass ?? {};
    const confirmColor = (options as { confirmButtonColor?: unknown })?.confirmButtonColor;
    const confirmColorText = (confirmColor ?? '').toString().toLowerCase();
    const isDangerConfirm =
      confirmColorText.includes('dc3545') ||
      confirmColorText.includes('b42318') ||
      confirmColorText.includes('danger');

    return Swal.fire({
      ...options,
      buttonsStyling: false,
      customClass: {
        confirmButton: customClass.confirmButton ?? (isDangerConfirm ? 'btn btn-danger' : 'btn btn-primary'),
        cancelButton: customClass.cancelButton ?? 'btn btn-outline-secondary',
        denyButton: customClass.denyButton ?? 'btn btn-danger',
        ...customClass,
      },
    });
  }
}


