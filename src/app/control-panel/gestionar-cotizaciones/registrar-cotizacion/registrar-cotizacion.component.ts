import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import {
  ClienteBusquedaResultado,
  CotizacionAdminCreatePayload,
  CotizacionAdminItemPayload,
  CotizacionAdminEventoPayload
} from '../model/cotizacion.model';
import { CotizacionService } from '../service/cotizacion.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { parseDateInput } from '../../../shared/utils/date-utils';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

type AlertIcon = 'success' | 'error' | 'warning' | 'info' | 'question';

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
  origen?: any;
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
  raw: any;
}

interface ProgramacionEventoItemConfig {
  nombre?: string;
  direccion?: string;
  fecha?: string;
  hora?: string;
  notas?: string;
  esPrincipal?: boolean;
}

@Component({
  selector: 'app-registrar-cotizacion',
  templateUrl: './registrar-cotizacion.component.html',
  styleUrls: ['./registrar-cotizacion.component.css']
})
export class RegistrarCotizacionComponent implements OnInit, OnDestroy {
  readonly fechaMinimaEvento = RegistrarCotizacionComponent.computeFechaMinimaEvento();
  readonly fechaMaximaEvento = RegistrarCotizacionComponent.computeFechaMaximaEvento();
  form: UntypedFormGroup = this.fb.group({
    clienteNombre: ['', [Validators.required, Validators.minLength(2)]],
    clienteContacto: ['', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]{6,15}$/)]],
    fechaEvento: [RegistrarCotizacionComponent.computeFechaMinimaEvento(), [Validators.required, this.fechaEventoEnRangoValidator()]],
    departamento: ['Lima', Validators.required],
    horasEstimadas: [6, [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1)]],
    descripcion: [''],
    totalEstimado: [0, Validators.min(0)],
    programacion: this.fb.array([])
  });

  servicios: any[] = [];
  eventos: any[] = [];
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
  detallePaqueteSeleccionado: any = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: UntypedFormBuilder,
    private readonly cotizacionService: CotizacionService,
    private readonly router: Router
  ) { }

  ngOnInit(): void {
    this.loadCatalogos();
    this.initClienteBusqueda();
    this.refreshSelectedPaquetesColumns();
    this.syncProgramacionFechas();
    this.form.get('fechaEvento')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(fecha => this.syncProgramacionFechas(fecha));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get programacion(): UntypedFormArray {
    return this.form.get('programacion') as UntypedFormArray;
  }

  addProgramacionItem(): void {
    const siguienteIndice = this.programacion.length + 1;
    const nombreAuto = `Locación ${siguienteIndice}`;
    this.programacion.push(this.createProgramacionItem({
      nombre: nombreAuto,
      fecha: this.form.get('fechaEvento')?.value ?? ''
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

  onServicioChange(servicioId: number | null | undefined): void {
    const parsed = this.parseNumber(servicioId);
    this.selectedServicioId = parsed ?? null;
    if (this.selectedServicioId == null) {
      this.selectedServicioNombre = '';
    } else {
      const selected = this.servicios.find(s => this.getId(s) === this.selectedServicioId);
      this.selectedServicioNombre = selected?.nombre ?? '';
    }
    this.loadEventosServicio();
  }

  onServicioDropdownChange(rawValue: string): void {
    this.onServicioChange(this.parseNumber(rawValue));
  }

  onEventoDropdownChange(rawValue: string): void {
    this.eventoSelectTouched = true;
    this.onEventoChange(this.parseNumber(rawValue));
  }

  onEventoChange(eventoId: number | null | undefined): void {
    const parsed = this.parseNumber(eventoId);
    this.selectedEventoId = parsed ?? null;
    if (this.selectedEventoId == null) {
      this.selectedEventoNombre = '';
    } else {
      const selected = this.eventos.find(e => this.getId(e) === this.selectedEventoId);
      this.selectedEventoNombre = selected?.nombre ?? '';
    }
    this.loadEventosServicio();
  }

  addPaquete(element: any): void {
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
    this.syncTotalEstimado();
  }

  removePaquete(key: string | number): void {
    this.selectedPaquetes = this.selectedPaquetes.filter(p => p.key !== key);
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

  getDetalleStaffLista(paquete: any): Array<any> {
    const lista = paquete?.staff?.detalle ?? paquete?.staff ?? [];
    return Array.isArray(lista) ? lista : [];
  }

  getEquiposLista(paquete: any): Array<any> {
    const lista = paquete?.equipos ?? [];
    return Array.isArray(lista) ? lista : [];
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
    const patch: Record<string, any> = {};
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

  pkgKey = (el: any) => this.getPkgKey(el);

  isInSeleccion(element: any): boolean {
    const key = this.getPkgKey(element);
    return this.selectedPaquetes.some(p => p.key === key);
  }

  hasOtroPaqueteDelServicio(element: any): boolean {
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
    const clienteNombre = (raw.clienteNombre ?? '').toString().trim();
    const clienteContacto = this.sanitizeContacto((raw.clienteContacto ?? '').toString());
    const fechaEvento = raw.fechaEvento;
    const departamento = (raw.departamento ?? '').toString().trim();
    const horasEstimadas = (raw.horasEstimadas ?? '').toString().trim();
    const descripcionBase = (raw.descripcion ?? '').toString().trim();
    const descripcion = descripcionBase || (clienteNombre ? `Solicitud de cotizacion de ${clienteNombre}` : 'Solicitud de cotizacion');
    const horasEstimadasNumero = this.parseHorasToNumber(horasEstimadas);
    const programacionRaw = this.programacion.getRawValue() as Array<Record<string, unknown>>;
    const eventos: CotizacionAdminEventoPayload[] = programacionRaw
      .map((config) => {
        const fecha = ((config['fecha'] ?? fechaEvento) || '').toString().trim();
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

    const clienteIdSeleccionado = this.parseNumber(this.clienteSeleccionado?.id);
    const items: CotizacionAdminItemPayload[] = this.selectedPaquetes.map((item) => {
      const notas = (item.notas ?? '').toString().trim();
      const eventoServicioId = this.getEventoServicioId(item) ?? this.getEventoServicioId(item.origen);
      const servicioId = this.getPaqueteServicioId(item);
      const horas = this.parseNumber(item.horas ?? this.getHoras(item.origen));
      const staff = this.parseNumber(item.staff ?? this.getStaff(item.origen));
      const fotosImpresas = this.parseNumber(item.fotosImpresas ?? this.getFotosImpresas(item.origen));
      const trailerMin = this.parseNumber(item.trailerMin ?? this.getTrailerMin(item.origen));
      const filmMin = this.parseNumber(item.filmMin ?? this.getFilmMin(item.origen));

      const payloadItem: CotizacionAdminItemPayload = {
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

    const payload: CotizacionAdminCreatePayload = {
      cotizacion: {
        idTipoEvento: this.selectedEventoId ?? undefined,
        tipoEvento: this.selectedEventoNombre || this.selectedServicioNombre || 'Evento',
        fechaEvento,
        lugar: departamento || undefined,
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
      eventos: eventos.length ? eventos : undefined
    };

    if (clienteIdSeleccionado != null) {
      payload.cliente = { id: clienteIdSeleccionado };
    }

    console.log('[cotizacion] payload listo para enviar', payload);
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
    return this.fb.group({
      nombre: [config.nombre ?? '', Validators.required],
      direccion: [config.direccion ?? '', Validators.required],
      fecha: [{ value: config.fecha ?? '', disabled: true }],
      hora: [config.hora ?? '', [Validators.required, Validators.pattern(/^\d{2}:\d{2}$/)]],
      notas: [config.notas ?? ''],
      esPrincipal: [config.esPrincipal ?? false]
    });
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
                const estadoNombre = (item?.estado?.nombre ?? item?.estadoNombre ?? '').toString().toLowerCase();
                const estadoId = item?.estado?.id ?? item?.estado?.idEstado ?? item?.estadoId;
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

  private getServicioNombre(item: any): string {
    if (!item) {
      return '';
    }
    return item?.nombre ?? '';
  }

  private getEventoNombre(item: any): string {
    if (!item) {
      return '';
    }
    return item?.nombre ?? '';
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

  private getId(item: any): number | null {
    return this.parseNumber(item?.id);
  }

  private getPkgKey(el: any): string {
    const eventoServicioId = this.getEventoServicioId(el);
    return eventoServicioId != null ? String(eventoServicioId) : '';
  }

  private getEventoServicioId(item: any): number | null {
    if (!item) {
      return null;
    }
    const num = this.parseNumber(item?.eventoServicioId ?? item?.idEventoServicio ?? item?.eventoServicio?.id ?? item?.id);
    return num != null && num > 0 ? num : null;
  }

  private getHoras(item: any): number | null {
    return this.parseNumber(item?.horas);
  }

  private getStaff(item: any): number | null {
    const staffTotal = item?.staff?.total;
    return this.parseNumber(staffTotal ?? item?.staff);
  }

  private getFotosImpresas(item: any): number | null {
    return this.parseNumber(item?.fotosImpresas);
  }

  private getTrailerMin(item: any): number | null {
    return this.parseNumber(item?.trailerMin);
  }

  private getFilmMin(item: any): number | null {
    return this.parseNumber(item?.filmMin);
  }

  private getTitulo(item: any): string {
    return item?.titulo ?? 'Paquete';
  }

  private getDescripcion(item: any): string {
    return item?.descripcion ?? this.getTitulo(item);
  }

  private getMoneda(item: any): string | undefined {
    const raw = item?.moneda;
    return raw ? String(raw).toUpperCase() : undefined;
  }

  private getGrupo(item: any): string | null {
    const raw = item?.grupo ?? null;
    return raw != null ? String(raw) : null;
  }

  private getPaqueteServicioId(item: any): number | null {
    if (!item) {
      return this.selectedServicioId;
    }
    const parsed = this.parseNumber(item?.servicio?.id ?? item?.servicioId);
    if (parsed != null) {
      return parsed;
    }
    return this.selectedServicioId;
  }

  private getPaqueteServicioNombre(item: any): string | undefined {
    const baseNombre = item?.servicio?.nombre ?? item?.servicioNombre;
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

  private getOpcion(item: any): number | null {
    return this.parseNumber(item?.opcion);
  }

  private getDescuento(item: any): number | null {
    return this.parseNumber(item?.descuento ?? null);
  }

  private getRecargo(item: any): number | null {
    return this.parseNumber(item?.recargo ?? null);
  }

  private normalizePaqueteRow(item: any): PaqueteRow {
    const precio = this.parseNumber(item?.precio);
    const staffTotal = this.parseNumber(item?.staff?.total ?? item?.staff);
    const staff = staffTotal ?? this.getStaff(item);
    const horas = this.getHoras(item) ?? this.parseHorasToNumber(item?.horasTexto ?? item?.HorasTexto);
    return {
      titulo: this.getTitulo(item),
      descripcion: this.getDescripcion(item),
      precio: precio != null ? precio : null,
      staff: staff != null ? staff : null,
      horas: horas != null ? horas : null,
      raw: item
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

  private parseNumber(raw: any): number | null {
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
      // { key: 'cantidad', header: 'Cantidad', sortable: false, class: 'text-center', width: '110px' },
      { key: 'precioUnit', header: 'Precio unit.', sortable: false, class: 'text-center', width: '140px' }
    ];

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
