import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl, UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, ValidatorFn, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ClienteBusquedaResultado, CotizacionAdminCreatePayload, CotizacionAdminItemPayload, CotizacionAdminEventoPayload, CotizacionAdminServicioFechaPayload } from '../model/cotizacion.model';
import { CotizacionService } from '../service/cotizacion.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { parseDateInput } from '../../../shared/utils/date-utils';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

type AlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';
type AnyRecord = Record<string, unknown>;

interface PaqueteSeleccionado {
  key: string | number;
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

@Component({
  selector: 'app-registrar-cotizacion',
  templateUrl: './registrar-cotizacion.component.html',
  styleUrls: ['./registrar-cotizacion.component.css']
})
export class RegistrarCotizacionComponent implements OnInit, OnDestroy {
  readonly fechaMinimaEvento = RegistrarCotizacionComponent.computeFechaMinimaEvento();
  readonly fechaMaximaEvento = RegistrarCotizacionComponent.computeFechaMaximaEvento();
  readonly horaOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly minutoOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
  readonly ampmOptions = ['AM', 'PM'] as const;
  form: UntypedFormGroup;

  servicios: AnyRecord[] = [];
  eventos: AnyRecord[] = [];
  selectedServicioId: number | null = null;
  selectedServicioNombre = '';
  selectedEventoId: number | null = null;
  selectedEventoNombre = '';
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
    'Ucayali'
  ];
  readonly programacionMinimaRecomendada = 1;
  readonly programacionMaxima = 6;
  clienteSearchControl = new UntypedFormControl('');
  clienteResultados: ClienteBusquedaResultado[] = [];
  clienteSearchLoading = false;
  clienteSearchError = '';
  clienteSeleccionado: ClienteBusquedaResultado | null = null;
  clienteBusquedaTermino = '';

  readonly clienteDisplay = (cliente?: ClienteBusquedaResultado | string | null): string => {
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
  loading = false;
  detallePaqueteAbierto = false;
  detallePaqueteSeleccionado: PaqueteDetalle | null = null;
  asignacionFechasAbierta = false;
  fechasDisponibles: string[] = [];
  serviciosFechasSeleccionadas: CotizacionAdminServicioFechaPayload[] = [];

  private readonly destroy$ = new Subject<void>();

  private readonly fb = inject(UntypedFormBuilder);
  private readonly cotizacionService = inject(CotizacionService);
  private readonly router = inject(Router);

  constructor() {
    this.form = this.fb.group({
      clienteNombre: ['', [Validators.required, Validators.minLength(2)]],
      clienteContacto: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]{6,15}$/)]],
      fechaEvento: [RegistrarCotizacionComponent.computeFechaMinimaEvento(), [Validators.required, this.fechaEventoEnRangoValidator()]],
      dias: [null, [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1)]],
      departamento: ['Lima', Validators.required],
      horasEstimadas: [{ value: '', disabled: true }, [Validators.pattern(/^\d+$/), Validators.min(1)]],
      descripcion: [''],
      totalEstimado: [0, Validators.min(0)],
      programacion: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.resetFormState();
    this.loadCatalogos();
    this.initClienteBusqueda();
    this.refreshSelectedPaquetesColumns();
    this.syncProgramacionFechas();
    this.form.get('fechaEvento')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(fecha => this.syncProgramacionFechas(fecha));
    this.form.get('dias')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => this.applyDiasRules(value));
    this.applyDiasRules(this.form.get('dias')?.value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.resetFormState();
  }

  get programacion(): UntypedFormArray {
    return this.form.get('programacion') as UntypedFormArray;
  }

  addProgramacionItem(): void {
    if (this.programacion.length >= this.programacionMaxima) {
      this.showAlert('warning', 'Límite alcanzado', `Máximo ${this.programacionMaxima} locaciones.`);
      return;
    }
    const siguienteIndice = this.programacion.length + 1;
    const nombreAuto = `Locación ${siguienteIndice}`;
    const fechaConfig = this.isMultipleDias() ? '' : (this.form.get('fechaEvento')?.value ?? '');
    this.programacion.push(this.createProgramacionItem({
      nombre: nombreAuto,
      fecha: fechaConfig
    }));
    this.ensureProgramacionPrincipales();
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
      this.showToast('success', 'Locación eliminada', 'Se eliminó la locación seleccionada.');
    });
  }

  get totalSeleccion(): number {
    return this.selectedPaquetes.reduce((acc, item) => {
      const precio = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + (precio * cantidad);
    }, 0);
  }

  private getTotalCantidadSeleccionada(): number {
    return this.selectedPaquetes.reduce((acc, item) => {
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + cantidad;
    }, 0);
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

  onServicioDropdownChange(rawValue: string): void {
    this.onServicioChange(this.parseNumber(rawValue));
  }

  onEventoDropdownChange(rawValue: string): void {
    this.eventoSelectTouched = true;
    const nextEventoId = this.parseNumber(rawValue);
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
    } else {
      const selected = this.eventos.find(e => this.getId(e) === this.selectedEventoId);
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

    let restantes: PaqueteSeleccionado[];
    if (servicioId != null) {
      restantes = this.selectedPaquetes.filter(item => (item.servicioId ?? null) !== servicioId);
    } else {
      const servicioNombreActual = (servicioNombre ?? this.selectedServicioNombre ?? '').toLowerCase();
      restantes = this.selectedPaquetes.filter(item =>
        (item.servicioId ?? null) != null
          ? true
          : (item.servicioNombre ?? '').toLowerCase() !== servicioNombreActual
      );
    }

    this.selectedPaquetes = [
      ...restantes,
      {
        key,
        titulo,
        descripcion,
        precio: precioBase,
        cantidad: 1,
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
        editandoPrecio: false
      }
    ];
    this.serviciosFechasSeleccionadas = [];
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
    this.selectedPaquetes = this.selectedPaquetes.filter(p => p.key !== key);
    this.serviciosFechasSeleccionadas = [];
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
    if (!this.serviciosFechasSeleccionadas.length) {
      this.serviciosFechasSeleccionadas = this.selectedPaquetes.flatMap((item, index) => {
        const itemTmpId = `i${index + 1}`;
        const cantidad = Math.max(1, Number(item.cantidad ?? 1) || 1);
        const fechas = this.fechasDisponibles.slice(0, cantidad);
        return fechas.map(fecha => ({ itemTmpId, fecha }));
      });
    } else {
      this.serviciosFechasSeleccionadas = this.serviciosFechasSeleccionadas.filter(entry =>
        this.fechasDisponibles.includes(entry.fecha)
      );
    }
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
    this.clienteSearchControl.valueChanges.pipe(
      map(value => typeof value === 'string' ? value.trim() : ''),
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
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => {
        this.clienteSearchLoading = true;
      }),
      switchMap(query =>
        this.cotizacionService.buscarClientes(query).pipe(
          catchError(err => {
            console.error('[cotizacion] buscarClientes', err);
            this.clienteSearchError = 'No pudimos cargar clientes.';
            this.clienteSearchLoading = false;
            this.showAlert('error', 'No pudimos cargar clientes.', 'Inténtalo nuevamente.');
            return of([]);
          })
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe(result => {
      this.clienteResultados = Array.isArray(result) ? result : [];
      this.clienteSearchLoading = false;
    });
  }

  resolveClienteDocumento(cliente?: ClienteBusquedaResultado | null): string {
    if (!cliente) {
      return '';
    }
    return (cliente.documento
      ?? cliente.numeroDocumento
      ?? cliente.ruc
      ?? cliente.identificador
      ?? '').toString();
  }

  resolveClienteContacto(cliente?: ClienteBusquedaResultado | null): string {
    if (!cliente) {
      return '';
    }
    return (cliente.contacto
      ?? cliente.celular
      ?? cliente.telefono
      ?? cliente.whatsapp
      ?? cliente.email
      ?? cliente.correo
      ?? '').toString();
  }

  private sanitizeContacto(valor: string): string {
    return (valor ?? '').toString().replace(/\D/g, '');
  }

  private setClienteControlsDisabled(disabled: boolean): void {
    ['clienteNombre', 'clienteContacto'].forEach(key => {
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
    return (cliente.nombreCompleto
      ?? cliente.nombre
      ?? cliente.razonSocial
      ?? cliente.contacto
      ?? cliente.email
      ?? '').toString();
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
    return this.selectedPaquetes.some(item => this.isPrecioModificado(item));
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
    paquete.cantidad = parsed != null && parsed >= 1 ? Math.floor(parsed) : 1;
    this.serviciosFechasSeleccionadas = [];
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
    const formInvalido = this.form.invalid;
    const eventoInvalido = this.selectedEventoId == null;
    const programacionInvalida = this.programacion.invalid;
    const programacionVacia = this.programacion.length === 0;

    if (formInvalido || eventoInvalido || programacionInvalida || programacionVacia) {
      if (formInvalido) {
        this.form.markAllAsTouched();
      }
      if (programacionInvalida || programacionVacia) {
        this.programacion.markAllAsTouched();
      }
      if (eventoInvalido) {
        this.eventoSelectTouched = true;
      }

      const mensaje = eventoInvalido
        ? 'Selecciona un tipo de evento.'
        : programacionVacia
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
    const clienteNombre = (raw.clienteNombre ?? '').toString().trim();
    const clienteContacto = this.sanitizeContacto((raw.clienteContacto ?? '').toString());
    const fechaEventoForm = raw.fechaEvento;
    const departamento = (raw.departamento ?? '').toString().trim();
    const horasEstimadas = (raw.horasEstimadas ?? '').toString().trim();
    const diasTexto = (raw.dias ?? '').toString().trim();
    const descripcionBase = (raw.descripcion ?? '').toString().trim();
    const descripcion = descripcionBase || (clienteNombre ? `Solicitud de cotizacion de ${clienteNombre}` : 'Solicitud de cotizacion');
    const horasEstimadasNumero = this.parseHorasToNumber(horasEstimadas);
    const programacionRaw = this.programacion.getRawValue() as Record<string, unknown>[];
    const eventos: CotizacionAdminEventoPayload[] = programacionRaw
      .map((config) => {
        const fecha = ((config['fecha'] ?? fechaEventoForm) || '').toString().trim();
        const hora = (config['hora'] ?? '').toString().trim();
        const ubicacion = (config['nombre'] ?? '').toString().trim();
        const direccion = (config['direccion'] ?? '').toString().trim();
        const notasTexto = (config['notas'] ?? '').toString().trim();
        if (!fecha && !hora && !ubicacion && !direccion && !notasTexto) {
          return null;
        }
        const horaNormalizada = hora
          ? (/^\d{2}:\d{2}$/.test(hora) ? `${hora}:00` : hora)
          : undefined;
        const evento: CotizacionAdminEventoPayload = {
          fecha: fecha || undefined,
          hora: horaNormalizada,
          ubicacion: ubicacion || undefined,
          direccion: direccion || undefined,
          notas: notasTexto ? notasTexto : null
        };
        return evento;
      })
      .filter((evento): evento is CotizacionAdminEventoPayload => evento != null);
    if (diasNumero != null && diasNumero > 1) {
      const fechasUnicas = new Set(
        programacionRaw
          .map((config) => (config['fecha'] ?? '').toString().trim())
          .filter(Boolean)
      );
      if (fechasUnicas.size < diasNumero) {
        this.showAlert(
          'warning',
          'Fechas insuficientes',
          `Para ${diasNumero} días de trabajo debes registrar al menos ${diasNumero} fechas diferentes en las locaciones.`
        );
        return;
      }
    }
    const fechaEvento = this.isMultipleDias()
      ? (eventos.find(ev => ev.fecha)?.fecha ?? '')
      : fechaEventoForm;

    const clienteIdSeleccionado = this.parseNumber(this.clienteSeleccionado?.id);
    const items: CotizacionAdminItemPayload[] = this.selectedPaquetes.map((item, index) => {
      const notas = (item.notas ?? '').toString().trim();
      const eventoServicioId = this.getEventoServicioId(item) ?? this.getEventoServicioId(item.origen);
      const servicioId = this.getPaqueteServicioId(item);
      const horas = this.parseNumber(item.horas ?? this.getHoras(item.origen));
      const staff = this.parseNumber(item.staff ?? this.getStaff(item.origen));
      const fotosImpresas = this.parseNumber(item.fotosImpresas ?? this.getFotosImpresas(item.origen));
      const trailerMin = this.parseNumber(item.trailerMin ?? this.getTrailerMin(item.origen));
      const filmMin = this.parseNumber(item.filmMin ?? this.getFilmMin(item.origen));

      const payloadItem: CotizacionAdminItemPayload = {
        tmpId: `i${index + 1}`,
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
        filmMin: filmMin ?? undefined
      };

      return payloadItem;
    });
    const fechasUnicas = Array.from(new Set(
      programacionRaw
        .map((config) => (config['fecha'] ?? '').toString().trim())
        .filter(Boolean)
    )).sort();
    const fechasBase = fechasUnicas.length ? fechasUnicas : (fechaEventoForm ? [String(fechaEventoForm)] : []);
    const serviciosFechasAuto = items.flatMap((item, index) => {
      const itemTmpId = item.tmpId ?? `i${index + 1}`;
      const cantidad = Math.max(1, Number(item.cantidad ?? 1) || 1);
      const fechas = fechasBase.slice(0, cantidad);
      return fechas.map(fecha => ({ itemTmpId, fecha }));
    });
    const serviciosFechas = this.isMultipleDias()
      ? (this.serviciosFechasSeleccionadas.length
          ? this.serviciosFechasSeleccionadas.filter(entry =>
              items.some(item => (item.tmpId ?? '') === entry.itemTmpId)
            )
          : serviciosFechasAuto)
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

    const payload: CotizacionAdminCreatePayload = {
      cotizacion: {
        idTipoEvento: this.selectedEventoId ?? undefined,
        tipoEvento: this.selectedEventoNombre || this.selectedServicioNombre || 'Evento',
        fechaEvento,
        lugar: departamento || undefined,
        dias: diasNumero ?? undefined,
        horasEstimadas: horasEstimadasNumero ?? undefined,
        mensaje: descripcion,
        estado: 'Borrador'
      },
      lead: {
        nombre: clienteNombre || undefined,
        celular: clienteContacto || undefined,
        origen: 'Backoffice'
      },
      items,
      serviciosFechas: serviciosFechas.length ? serviciosFechas : undefined,
      eventos: eventos.length ? eventos : undefined
    };

    if (clienteIdSeleccionado != null) {
      payload.cliente = { id: clienteIdSeleccionado };
    }

    // Detener envío real para pruebas: solo mostramos el payload.

    this.loading = true;
    this.cotizacionService.createCotizacion(payload)
      .pipe(
        finalize(() => this.loading = false),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          void Swal.fire({
            icon: 'success',
            title: 'Cotización registrada',
            text: 'La cotización se registró correctamente.'
          }).then(() => this.router.navigate(['/home/gestionar-cotizaciones']));
        },
        error: (err) => {
          console.error('[cotizacion] create', err);
          this.showAlert('error', 'Error al registrar', 'No pudimos registrar la cotización. Inténtalo nuevamente.');
        }
      });
  }

  cancel(): void {
    this.router.navigate(['/home/gestionar-cotizaciones']);
  }

  private syncProgramacionFechas(fecha?: string | null): void {
    if (this.isMultipleDias()) {
      return;
    }
    const fechaReferencia = fecha ?? this.form.get('fechaEvento')?.value ?? '';
    this.programacion.controls.forEach(control => {
      const grupo = control as UntypedFormGroup;
      const fechaControl = grupo.get('fecha');
      if (!fechaControl) {
        return;
      }
      fechaControl.setValue(fechaReferencia, { emitEvent: false });
      if (!fechaControl.disabled) {
        fechaControl.disable({ emitEvent: false });
      }
    });
  }

  private createProgramacionItem(config: ProgramacionEventoItemConfig = {}): UntypedFormGroup {
    const hora24 = this.normalizeHora24(config.hora ?? '');
    const horaParts = this.splitHoraTo12(hora24);
    const multiple = this.isMultipleDias();
    const grupo = this.fb.group({
      nombre: [config.nombre ?? '', Validators.required],
      direccion: [config.direccion ?? '', Validators.required],
      fecha: [{ value: config.fecha ?? '', disabled: !multiple },
        multiple ? [Validators.required, this.fechaEventoEnRangoValidator()] : []],
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
          lastValid = value;
          return;
        }
        const fechasPermitidas = fechasUnicas.filter(item => item !== fecha);
        const last = (lastValid ?? '').toString().trim();
        if (last && !fechasPermitidas.includes(last)) {
          fechasPermitidas.unshift(last);
        }
        const fechasTexto = fechasPermitidas.slice(0, maxDias);
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
      });
  }

  isMultipleDias(): boolean {
    const value = this.form.get('dias')?.value;
    const parsed = this.parseNumber(value);
    return parsed != null && parsed > 1;
  }

  private getFechasProgramacionUnicas(): string[] {
    const fechas = this.programacion.controls
      .map(control => (control as UntypedFormGroup).get('fecha')?.value)
      .map(value => (value ?? '').toString().trim())
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

  shouldShowFechaEvento(): boolean {
    const value = this.form.get('dias')?.value;
    const parsed = this.parseNumber(value);
    return parsed != null && parsed <= 1;
  }

  private applyDiasRules(value: unknown): void {
    const parsed = this.parseNumber(value);
    const multiple = parsed != null && parsed > 1;
    const fechaControl = this.form.get('fechaEvento');
    const horasControl = this.form.get('horasEstimadas');
    if (fechaControl) {
      if (multiple) {
        fechaControl.clearValidators();
        fechaControl.setValue(null, { emitEvent: false });
      } else {
        fechaControl.setValidators([Validators.required, this.fechaEventoEnRangoValidator()]);
        if (!fechaControl.value) {
          fechaControl.setValue(RegistrarCotizacionComponent.computeFechaMinimaEvento(), { emitEvent: false });
        }
      }
      fechaControl.updateValueAndValidity({ emitEvent: false });
    }
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
      if (multiple) {
        if (fechaProg.disabled) {
          fechaProg.enable({ emitEvent: false });
        }
        fechaProg.setValidators([Validators.required, this.fechaEventoEnRangoValidator()]);
      } else {
        fechaProg.clearValidators();
        this.syncProgramacionFechas();
      }
      fechaProg.updateValueAndValidity({ emitEvent: false });
    });

    if (!multiple && this.selectedPaquetes.some(item => (item.cantidad ?? 1) !== 1)) {
      this.selectedPaquetes = this.selectedPaquetes.map(item => ({ ...item, cantidad: 1 }));
      this.syncTotalEstimado();
    }

    if (!multiple && this.serviciosFechasSeleccionadas.length) {
      this.serviciosFechasSeleccionadas = [];
    }
    if (!multiple && this.asignacionFechasAbierta) {
      this.asignacionFechasAbierta = false;
    }

    this.refreshSelectedPaquetesColumns();
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

  private loadCatalogos(): void {
    this.loadingCatalogos = true;

    this.cotizacionService.getServicios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: servicios => {
          this.servicios = Array.isArray(servicios) ? servicios : [];
          if (!this.servicios.length) {
            this.selectedServicioId = null;
            this.selectedServicioNombre = '';
          } else if (this.selectedServicioId == null) {
            const firstValido = this.servicios.find(item => this.getId(item) != null) || null;
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
        }
      });

    this.cotizacionService.getEventos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: eventos => {
          this.eventos = Array.isArray(eventos) ? eventos : [];
          if (!this.eventos.length) {
            this.selectedEventoId = null;
            this.selectedEventoNombre = '';
          } else if (this.selectedEventoId != null) {
            const selected = this.eventos.find(e => this.getId(e) === this.selectedEventoId);
            this.selectedEventoNombre = this.getEventoNombre(selected);
          }
          this.loadEventosServicio();
        },
        error: (err) => {
          console.error('[cotizacion] eventos', err);
          this.eventos = [];
          this.selectedEventoId = null;
          this.selectedEventoNombre = '';
          this.loadEventosServicio();
        }
      });
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

  syncTotalEstimado(): void {
    const control = this.form.get('totalEstimado');
    if (!control?.dirty) {
      control?.setValue(this.totalSeleccion, { emitEvent: false });
    }
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
    const num = this.parseNumber(record['eventoServicioId'] ?? record['idEventoServicio'] ?? eventoServicio['id'] ?? record['id']);
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
    const staffTotal = this.parseNumber(staffRecord['total'] ?? record['staff']);
    const staff = staffTotal ?? this.getStaff(record);
    const horas = this.getHoras(record) ?? this.parseHorasToNumber(String(record['horasTexto'] ?? record['HorasTexto'] ?? ''));
    return {
      titulo: this.getTitulo(record),
      descripcion: this.getDescripcion(record),
      precio: precio != null ? precio : null,
      staff: staff != null ? staff : null,
      horas: horas != null ? horas : null,
      raw: record
    };
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

  private resetFormState(): void {
    this.form.reset({
      clienteNombre: '',
      clienteContacto: '',
      fechaEvento: RegistrarCotizacionComponent.computeFechaMinimaEvento(),
      dias: null,
      departamento: 'Lima',
      horasEstimadas: '',
      descripcion: '',
      totalEstimado: 0
    }, { emitEvent: false });

    const horasControl = this.form.get('horasEstimadas');
    if (horasControl) {
      horasControl.disable({ emitEvent: false });
    }

    while (this.programacion.length) {
      this.programacion.removeAt(0);
    }

    this.selectedPaquetes = [];
    this.paquetesRows = [];
    this.selectedEventoId = null;
    this.selectedEventoNombre = '';
    this.selectedServicioId = null;
    this.selectedServicioNombre = '';
    this.clienteSeleccionado = null;
    this.clienteResultados = [];
    this.clienteBusquedaTermino = '';
    this.eventoSelectTouched = false;
    this.asignacionFechasAbierta = false;
    this.fechasDisponibles = [];
    this.serviciosFechasSeleccionadas = [];
    this.syncTotalEstimado();
  }
}
