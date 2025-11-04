import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, finalize, switchMap, takeUntil } from 'rxjs';

import { Cotizacion, CotizacionItemPayload, CotizacionPayload } from '../model/cotizacion.model';
import { CotizacionService } from '../service/cotizacion.service';
import { formatIsoDate } from '../../../shared/utils/date-utils';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

interface PaqueteSeleccionado {
  key: string | number;
  titulo: string;
  descripcion: string;
  precio: number;
  cantidad: number;
  moneda?: string;
  grupo?: string | null;
  opcion?: number | null;
  personal?: number | null;
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
  descripcion: string;
  precio: number | null;
  staff: number | null;
  horas: number | null;
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

type ProgramacionEventoItem = ProgramacionEventoItemConfig & { esPrincipal: boolean };

interface EventoCatalogo {
  id: number;
  nombre: string;
  raw: any;
}

@Component({
  selector: 'app-editar-cotizacion',
  templateUrl: './editar-cotizacion.component.html',
  styleUrls: ['./editar-cotizacion.component.css']
})
export class EditarCotizacionComponent implements OnInit, OnDestroy {
  readonly fechaMinimaEvento = EditarCotizacionComponent.computeFechaMinimaEvento();
  readonly fechaMaximaEvento = EditarCotizacionComponent.computeFechaMaximaEvento();

  form: UntypedFormGroup = this.fb.group({
    clienteNombre: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(2)]],
    clienteContacto: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(6)]],
    fechaEvento: ['', [Validators.required, this.fechaEventoEnRangoValidator()]],
    horasEstimadas: ['', [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1)]],
    departamento: ['', Validators.required],
    descripcion: [''],
    totalEstimado: [0, Validators.min(0)],
    programacion: this.fb.array([])
  });

  servicios: any[] = [];
  eventos: EventoCatalogo[] = [];
  selectedServicioId: number | null = null;
  selectedServicioNombre = '';
  selectedEventoId: number | null = null;
  selectedEventoNombre = '';
  selectedEventoIdValue = '';

  paquetesColumns: TableColumn<PaqueteRow>[] = [
    { key: 'descripcion', header: 'Descripción', sortable: true },
    { key: 'precio', header: 'Precio', sortable: true, class: 'text-end text-nowrap', width: '120px' },
    { key: 'staff', header: 'Staff', sortable: true, class: 'text-center', width: '100px' },
    { key: 'horas', header: 'Horas', sortable: true, class: 'text-center', width: '100px' },
    { key: 'acciones', header: 'Seleccionar', sortable: false, filterable: false, class: 'text-center', width: '140px' }
  ];
  paquetesRows: PaqueteRow[] = [];
  selectedPaquetes: PaqueteSeleccionado[] = [];
  selectedPaquetesColumns: TableColumn<PaqueteSeleccionado>[] = [];

  loadingCatalogos = false;
  loadingPaquetes = false;
  loading = true;
  saving = false;

  private cotizacion: Cotizacion | null = null;
  private pendingServicioId: number | null = null;
  private pendingEventoId: number | null = null;
  private fechaEventoOriginal: string | null = null;

  private readonly destroy$ = new Subject<void>();
  readonly programacionMinimaRecomendada = 2;
  private readonly serviciosSeleccionados = new Set<string>();
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

  constructor(
    private readonly fb: UntypedFormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly cotizacionService: CotizacionService,
    private readonly snackBar: MatSnackBar
  ) {}

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
    const fechaRef = this.form.get('fechaEvento')?.value ?? this.fechaEventoOriginal ?? '';
    this.programacion.push(this.createProgramacionItem({ nombre: nombreAuto, fecha: fechaRef, esPrincipal: siguienteIndice <= this.programacionMinimaRecomendada }));
    this.syncProgramacionFechas(fechaRef);
  }

  get totalSeleccion(): number {
    return this.selectedPaquetes.reduce((acc, item) => {
      const precio = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + (precio * cantidad);
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
      this.selectedServicioNombre = selected?.nombre ?? selected?.Servicio ?? selected?.descripcion ?? '';
    }
    this.loadEventosServicio();
  }

  onEventoDropdownChange(rawValue: string): void {
    this.eventoSelectTouched = true;
    this.onEventoChange(this.parseNumber(rawValue));
  }

  onEventoChange(eventoId: number | null | undefined): void {
    const parsed = this.parseNumber(eventoId);
    this.selectedEventoId = parsed ?? null;
    this.selectedEventoIdValue = this.selectedEventoId != null ? String(this.selectedEventoId) : '';
    if (this.selectedEventoId == null) {
      this.selectedEventoNombre = '';
    } else {
      const selected = this.eventos.find(e => e.id === this.selectedEventoId);
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
    const servicioIdReal = this.getPaqueteServicioId(element, false);
    const servicioNombreReal = this.getPaqueteServicioNombre(element, false);
    const servicioId = servicioIdReal ?? this.selectedServicioId ?? null;
    const servicioNombreDisplay = servicioIdReal != null
      ? servicioNombreReal ?? undefined
      : (servicioNombreReal ?? this.selectedServicioNombre ?? undefined);
    const servicioKey = this.buildServicioKey(servicioId, servicioNombreDisplay);
    if (servicioKey && this.serviciosSeleccionados.has(servicioKey)) {
      this.snackBar.open('Ya seleccionaste una opción para este servicio.', 'Cerrar', { duration: 4000 });
      return;
    }
    const horas = this.getHoras(element);
    const personal = this.getPersonal(element);
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
    this.selectedPaquetes = [
      ...this.selectedPaquetes,
      {
        key,
        titulo,
        descripcion,
        precio: precioBase,
        cantidad: 1,
        moneda: moneda ?? undefined,
        grupo,
        opcion,
        personal: personal ?? undefined,
        horas: horas ?? undefined,
        fotosImpresas: fotosImpresas ?? undefined,
        trailerMin: trailerMin ?? undefined,
        filmMin: filmMin ?? undefined,
        descuento,
        recargo,
        notas: '',
        eventoServicioId: eventoServicioId ?? undefined,
        servicioId,
        servicioNombre: servicioNombreDisplay,
        origen: element,
        precioOriginal: precioBase,
        editandoPrecio: false
      }
    ];
    if (servicioKey) {
      this.serviciosSeleccionados.add(servicioKey);
    }
    this.syncTotalEstimado();
  }

  removePaquete(key: string | number): void {
    const paquete = this.selectedPaquetes.find(p => p.key === key);
    if (!paquete) {
      return;
    }
    const clave = this.buildServicioKey(
      paquete.servicioId ?? this.getPaqueteServicioId(paquete.origen, false),
      paquete.servicioNombre ?? this.getPaqueteServicioNombre(paquete.origen, false)
    );
    this.selectedPaquetes = this.selectedPaquetes.filter(p => p.key !== key);
    if (clave) {
      this.serviciosSeleccionados.delete(clave);
    }
    this.syncTotalEstimado();
  }

  pkgKey = (el: any) => this.getPkgKey(el);

  isInSeleccion(element: any): boolean {
    const key = this.getPkgKey(element);
    return this.selectedPaquetes.some(p => p.key === key);
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
      this.snackBar.open('Solo puedes reducir el precio hasta un 5% respecto al valor base.', 'Cerrar', {
        duration: 3000
      });
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

  update(): void {
    if (!this.cotizacion) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Revisa los campos obligatorios.', 'Cerrar', { duration: 4000 });
      return;
    }

    if (!this.selectedPaquetes.length) {
      this.snackBar.open('Selecciona al menos un paquete para la cotización.', 'Cerrar', { duration: 4000 });
      return;
    }

    const raw = this.form.getRawValue();
    console.log('Raw form data:', raw);
    const rawPayload = (this.cotizacion.raw as CotizacionPayload | undefined);
    const rawContacto = rawPayload?.contacto;
    const rawDetalle = rawPayload?.cotizacion;
    const rawContexto = rawPayload?.contexto;
    const eventoSeleccionadoId = this.selectedEventoId ?? rawDetalle?.eventoId ?? this.cotizacion?.eventoId ?? null;
    this.eventoSelectTouched = eventoSeleccionadoId == null;
    if (this.eventoSelectTouched) {
      this.snackBar.open('Selecciona un tipo de evento.', 'Cerrar', { duration: 4000 });
      return;
    }

    const clienteNombre = (raw.clienteNombre ?? '').toString().trim();
    const horasEstimadas = (raw.horasEstimadas ?? '').toString().trim();
    const descripcionBase = (raw.descripcion ?? '').toString().trim();
    const descripcion = descripcionBase || (clienteNombre ? `Solicitud de cotización de ${clienteNombre}` : 'Solicitud de cotización');
    const clienteContacto = (raw.clienteContacto ?? '').toString().trim();
    const fechaEvento = this.normalizeDateForPayload(raw.fechaEvento) ??
      this.normalizeDateForPayload(this.fechaEventoOriginal);
    if (!fechaEvento) {
      this.snackBar.open('No pudimos interpretar la fecha del evento.', 'Cerrar', { duration: 4000 });
      return;
    }
    const departamento = (raw.departamento ?? '').toString().trim();
    const clienteId = rawContexto?.clienteId;
    const horasEstimadasNumero = this.parseHorasToNumber(horasEstimadas ?? rawContexto?.horasEstimadasTexto);
    const totalEstimado = Number(raw.totalEstimado ?? this.totalSeleccion) || this.totalSeleccion;

    const items: CotizacionItemPayload[] = this.selectedPaquetes.map((item, index) => ({
      idEventoServicio: item.eventoServicioId ?? this.getEventoServicioId(item.origen) ?? undefined,
      grupo: item.grupo ?? this.getGrupo(item.origen) ?? this.deriveGrupo(),
      opcion: item.opcion ?? index + 1,
      titulo: item.titulo,
      descripcion: item.descripcion,
      moneda: item.moneda ?? this.getMoneda(item.origen) ?? 'USD',
      precioUnitario: Number(item.precio) || 0,
      cantidad: Number(item.cantidad ?? 1) || 1,
      descuento: item.descuento ?? this.getDescuento(item.origen) ?? undefined,
      recargo: item.recargo ?? this.getRecargo(item.origen) ?? undefined,
      notas: item.notas,
      horas: item.horas ?? this.getHoras(item.origen),
      personal: item.personal ?? this.getPersonal(item.origen),
      fotosImpresas: item.fotosImpresas ?? this.getFotosImpresas(item.origen),
      trailerMin: item.trailerMin ?? this.getTrailerMin(item.origen),
      filmMin: item.filmMin ?? this.getFilmMin(item.origen)
    }));

    const eventos = this.programacion.controls
      .map(control => (control.value ?? {}) as Record<string, unknown>)
      .filter(config => this.hasProgramacionContent(config))
      .map(config => {
        const fechaNormalizada = this.normalizeProgramacionFecha(config['fecha']) ?? fechaEvento;
        const horaNormalizada = this.normalizeProgramacionHora(config['hora']);
        const ubicacion = String(config['nombre'] ?? '').trim();
        const direccion = String(config['direccion'] ?? '').trim();
        const notas = String(config['notas'] ?? '').trim();
        return {
          fecha: fechaNormalizada ?? undefined,
          hora: horaNormalizada ?? undefined,
          ubicacion: ubicacion || undefined,
          direccion: direccion || undefined,
          notas: notas || undefined
        };
      });

    const payload: CotizacionPayload = {
      contacto: {
        nombre: clienteNombre,
        celular: clienteContacto,
        origen: rawContacto?.origen ?? 'Backoffice',
        correo: rawContacto?.correo
      },
      cotizacion: {
        idCotizacion: this.cotizacion.id,
        eventoId: eventoSeleccionadoId ?? undefined,
        tipoEvento: this.selectedEventoNombre || rawContexto?.eventoNombre || rawDetalle?.tipoEvento || this.selectedServicioNombre,
        fechaEvento,
        lugar: departamento || rawDetalle?.lugar,
        horasEstimadas: horasEstimadasNumero,
        mensaje: descripcion,
        estado: rawDetalle?.estado ?? this.cotizacion.estado ?? 'Enviada',
        totalEstimado
      },
      items,
      eventos,
      contexto: {
        clienteId,
        servicioId: this.selectedServicioId ?? rawContexto?.servicioId,
        servicioNombre: this.selectedServicioNombre || rawContexto?.servicioNombre,
        eventoNombre: this.selectedEventoNombre || rawContexto?.eventoNombre || rawDetalle?.tipoEvento,
        horaEvento: rawContexto?.horaEvento,
        horasEstimadasTexto: horasEstimadas || rawContexto?.horasEstimadasTexto
      }
    };

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
          this.snackBar.open('No pudimos actualizar la cotización.', 'Cerrar', { duration: 5000 });
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
          this.snackBar.open('No pudimos cargar la cotización.', 'Cerrar', { duration: 5000 });
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
    if (departamento && !this.departamentos.includes(departamento)) {
      this.departamentos.push(departamento);
    }

    this.form.patchValue({
      clienteNombre: nombre,
      clienteContacto: contacto,
      fechaEvento: fechaEventoIso,
      horasEstimadas: horasTexto,
      departamento,
      descripcion: detalle?.mensaje ?? cotizacion.notas ?? '',
      totalEstimado: detalle?.totalEstimado ?? cotizacion.total ?? 0
    }, { emitEvent: false });

    const servicioId = this.parseNumber(contexto?.servicioId ?? cotizacion.servicioId);
    this.pendingServicioId = servicioId != null && servicioId > 0 ? servicioId : null;
    const eventoId = this.parseNumber(
      detalle?.eventoId ??
      detalle?.idTipoEvento ??
      (contexto as any)?.eventoId ??
      cotizacion.eventoId
    );
    this.pendingEventoId = eventoId != null && eventoId > 0 ? eventoId : null;
    this.selectedServicioId = this.pendingServicioId;
    this.selectedServicioNombre = contexto?.servicioNombre ?? cotizacion.servicio ?? '';
    this.selectedEventoId = this.pendingEventoId;
    this.selectedEventoIdValue = this.selectedEventoId != null ? String(this.selectedEventoId) : '';
    this.selectedEventoNombre = contexto?.eventoNombre ?? detalle?.tipoEvento ?? cotizacion.evento ?? '';

    this.selectedPaquetes = (raw?.items ?? cotizacion.items ?? []).map((item, index) => {
      const horas = this.getHoras(item);
      const personal = this.getPersonal(item);
      const fotosImpresas = this.getFotosImpresas(item);
      const trailerMin = this.getTrailerMin(item);
      const filmMin = this.getFilmMin(item);
      const precioUnitario = Number((item as any)?.precio ?? item.precioUnitario ?? 0) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      const paqueteServicioId = this.getPaqueteServicioId(item, false);
      const paqueteServicioNombre = this.getPaqueteServicioNombre(item, false);
      return {
        key: this.getPkgKey(item),
        titulo: this.getTitulo(item),
        descripcion: this.getDescripcion(item),
        precio: precioUnitario,
        cantidad,
        moneda: this.getMoneda(item) ?? undefined,
        grupo: this.getGrupo(item),
        opcion: item.opcion ?? index + 1,
        eventoServicioId: this.getEventoServicioId(item) ?? undefined,
        notas: item.notas,
        horas: horas ?? undefined,
        personal: personal ?? undefined,
        fotosImpresas: fotosImpresas ?? undefined,
        trailerMin: trailerMin ?? undefined,
        filmMin: filmMin ?? undefined,
        descuento: this.getDescuento(item),
        recargo: this.getRecargo(item),
        servicioId: paqueteServicioId,
        servicioNombre: paqueteServicioNombre ?? contexto?.servicioNombre ?? cotizacion.servicio ?? undefined,
        origen: item,
        precioOriginal: Number((item as any)?.precioOriginal ?? precioUnitario) || precioUnitario,
        editandoPrecio: false
      };
    });

    const programacionEventos = this.extractProgramacionEventos(cotizacion, raw);
    this.populateProgramacion(programacionEventos);

    this.rebuildServiciosSeleccionados();
    this.syncTotalEstimado();
    this.applyPendingSelections();
    this.programacion.markAsPristine();
    this.programacion.markAsUntouched();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  private populateProgramacion(eventos: ProgramacionEventoItemConfig[]): void {
    const array = this.programacion;
    this.clearFormArray(array);

    let configs: ProgramacionEventoItem[] = eventos.map((config, index) => ({
      ...config,
      esPrincipal: config.esPrincipal ?? index < this.programacionMinimaRecomendada
    })).filter(config => this.hasProgramacionContent(config));

    if (!configs.length) {
      configs = this.buildFallbackProgramacion();
    } else if (configs.length < this.programacionMinimaRecomendada) {
      configs = [
        ...configs,
        ...this.buildFallbackProgramacion().slice(configs.length)
      ];
    }

    configs.forEach(config => {
      array.push(this.createProgramacionItem(config));
    });

    this.syncProgramacionFechas(this.form.get('fechaEvento')?.value ?? this.fechaEventoOriginal);
  }

  private extractProgramacionEventos(cotizacion: Cotizacion, raw?: CotizacionPayload | null): ProgramacionEventoItem[] {
    const candidates: unknown[] = [
      (raw as any)?.cotizacion?.eventos,
      (raw as any)?.eventos,
      (cotizacion as any)?.eventos,
      (cotizacion.raw as any)?.eventos
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) {
        return candidate
          .map((evento: any, index: number) => this.mapEventoToConfig(evento, index))
          .filter(config => this.hasProgramacionContent(config));
      }
    }

    return [];
  }

  private mapEventoToConfig(evento: Record<string, any>, index: number): ProgramacionEventoItem {
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
    return this.fb.group({
      nombre: [config.nombre ?? ''],
      direccion: [config.direccion ?? ''],
      fecha: [{ value: config.fecha ?? '', disabled: true }],
      hora: [config.hora ?? '', [Validators.pattern(/^\d{2}:\d{2}$/)]],
      notas: [config.notas ?? ''],
      esPrincipal: [config.esPrincipal ?? false]
    });
  }

  private buildFallbackProgramacion(): ProgramacionEventoItem[] {
    const fecha = this.normalizeProgramacionFecha(this.fechaEventoOriginal);
    const principal = this.pickFirstString(
      this.form.get('departamento')?.value,
      this.selectedEventoNombre,
      this.cotizacion?.lugar,
      this.cotizacion?.eventoSolicitado,
      'Locación principal'
    ) || 'Locación principal';

    return [
      { nombre: principal, fecha, esPrincipal: true },
      { nombre: 'Locación adicional', fecha, esPrincipal: false }
    ];
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
      if (fechaControl.value !== referencia) {
        fechaControl.setValue(referencia, { emitEvent: false });
      }
      if (!fechaControl.disabled) {
        fechaControl.disable({ emitEvent: false });
      }
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
      const date = new Date(raw);
      if (Number.isNaN(date.valueOf())) {
        return { fechaEventoInvalida: true };
      }
      const min = new Date(this.fechaMinimaEvento);
      const max = new Date(this.fechaMaximaEvento);
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

  private pickFirstString(...values: Array<unknown>): string {
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

  private normalizeEventoCatalogo(evento: any): EventoCatalogo | null {
    const id = this.parseNumber(evento?.PK_E_Cod ?? evento?.id ?? evento?.ID);
    if (id == null || id <= 0) {
      return null;
    }
    const nombre = this.pickFirstString(evento?.E_Nombre, evento?.nombre, evento?.Evento) || 'Evento';
    return { id, nombre, raw: evento };
  }

  private applyPendingSelections(): void {
    if (this.pendingServicioId != null) {
      const servicio = this.servicios.find(s => this.getId(s) === this.pendingServicioId);
      if (servicio) {
        this.selectedServicioId = this.pendingServicioId;
        this.selectedServicioNombre = servicio?.nombre ?? servicio?.Servicio ?? servicio?.descripcion ?? '';
      }
    } else if (!this.selectedServicioId && this.servicios.length && !this.selectedServicioNombre) {
      // Mantiene la lista vacía hasta que se vincule un servicio manualmente
      this.selectedServicioId = null;
      this.selectedServicioNombre = '';
    }

    if (this.pendingEventoId != null) {
      const evento = this.eventos.find(e => e.id === this.pendingEventoId);
      if (evento) {
        this.selectedEventoId = evento.id;
        this.selectedEventoNombre = evento.nombre;
        this.selectedEventoIdValue = String(evento.id);
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
          this.paquetesRows = Array.isArray(paquetes)
            ? paquetes.map(item => this.normalizePaqueteRow(item))
            : [];
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
    if (!control?.dirty) {
      control?.setValue(this.totalSeleccion || control.value || 0, { emitEvent: false });
    }
    this.refreshSelectedPaquetesColumns();
  }

  getId(item: any): number | null {
    if (!item) return null;
    const raw = item?.id ?? item?.ID ?? item?.pk ?? item?.PK_E_Cod;
    if (raw == null) return null;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  private getPkgKey(el: any): string {
    const eventoServicioId = this.getEventoServicioId(el);
    if (eventoServicioId != null) {
      return String(eventoServicioId);
    }
    return String(el?.ID ?? el?.PK_ExS_Cod ?? `${el?.descripcion}|${el?.precio}`);
  }

  private getEventoServicioId(item: any): number | null {
    if (!item) {
      return null;
    }
    const raw = item?.eventoServicioId ?? item?.idEventoServicio ?? item?.ID_EventoServicio ?? item?.ID ?? item?.PK_ExS_Cod ?? item?.pkEventoServicio;
    if (raw == null) {
      return null;
    }
    if (typeof raw === 'string' && raw.trim() === '') {
      return null;
    }
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  private getHoras(item: any): number | null {
    return this.parseNumber(item?.horas ?? item?.Horas ?? item?.duration ?? item?.Duracion);
  }

  private getPersonal(item: any): number | null {
    return this.parseNumber(item?.personal ?? item?.Personal ?? item?.staff ?? item?.Staff);
  }

  private getFotosImpresas(item: any): number | null {
    return this.parseNumber(item?.fotosImpresas ?? item?.FotosImpresas ?? item?.fotos_impresas);
  }

  private getTrailerMin(item: any): number | null {
    return this.parseNumber(item?.trailerMin ?? item?.TrailerMin ?? item?.minTrailer ?? item?.Trailer);
  }

  private getFilmMin(item: any): number | null {
    return this.parseNumber(item?.filmMin ?? item?.FilmMin ?? item?.minFilm ?? item?.Film);
  }

  private normalizePaqueteRow(item: any): PaqueteRow {
    const precio = this.parseNumber(item?.precio ?? item?.Precio);
    const staff = this.getPersonal(item);
    const horas = this.getHoras(item) ?? this.parseHorasToNumber(item?.horasTexto ?? item?.HorasTexto);
    return {
      descripcion: this.getDescripcion(item),
      precio: precio != null ? precio : null,
      staff: staff != null ? staff : null,
      horas: horas != null ? horas : null,
      raw: item
    };
  }

  private getTitulo(item: any): string {
    return item?.titulo ?? item?.Titulo ?? item?.nombre ?? item?.Nombre ?? item?.descripcion ?? item?.Descripcion ?? 'Paquete';
  }

  private getDescripcion(item: any): string {
    return item?.descripcion ?? item?.Descripcion ?? item?.detalle ?? item?.Detalle ?? this.getTitulo(item);
  }

  private getMoneda(item: any): string | undefined {
    const raw = item?.moneda ?? item?.Moneda ?? item?.currency ?? item?.Currency;
    return raw ? String(raw).toUpperCase() : undefined;
  }

  private getGrupo(item: any): string | null {
    const raw = item?.grupo ?? item?.Grupo ?? item?.categoria ?? item?.Categoria ?? null;
    return raw != null ? String(raw) : null;
  }

  private getPaqueteServicioId(item: any, fallbackToSelected = true): number | null {
    if (!item) {
      return this.selectedServicioId;
    }
    const raw =
      item?.servicioId ??
      item?.idServicio ??
      item?.ID_Servicio ??
      item?.servicio_id ??
      item?.ServicioId ??
      null;
    const parsed = this.parseNumber(raw);
    if (parsed != null) {
      return parsed;
    }
    return fallbackToSelected ? this.selectedServicioId : null;
  }

  private getPaqueteServicioNombre(item: any, fallbackToSelected = true): string | undefined {
    const baseNombre =
      item?.servicioNombre ??
      item?.ServicioNombre ??
      item?.servicio ??
      item?.Servicio ??
      item?.nombreServicio ??
      item?.NombreServicio ??
      null;
    if (baseNombre != null) {
      const texto = String(baseNombre).trim();
      if (texto) {
        return texto;
      }
    }
    return fallbackToSelected ? (this.selectedServicioNombre || undefined) : undefined;
  }

  private buildServicioKey(servicioId: number | null | undefined, servicioNombre?: string | null): string | null {
    if (servicioId != null && Number.isFinite(servicioId)) {
      return `id:${servicioId}`;
    }
    const nombre = this.normalizeServicioNombre(servicioNombre);
    if (nombre) {
      return `nombre:${nombre}`;
    }
    return null;
  }

  private normalizeServicioNombre(nombre: string | undefined | null): string | null {
    const texto = (nombre ?? '').toString().trim();
    return texto ? texto.toLowerCase() : null;
  }

  private rebuildServiciosSeleccionados(): void {
    this.serviciosSeleccionados.clear();
    this.selectedPaquetes.forEach(item => {
      const clave = this.buildServicioKey(
        item.servicioId ?? this.getPaqueteServicioId(item.origen, false),
        item.servicioNombre ?? this.getPaqueteServicioNombre(item.origen, false)
      );
      if (clave) {
        this.serviciosSeleccionados.add(clave);
      }
    });
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
    return this.parseNumber(item?.opcion ?? item?.Opcion ?? item?.Option ?? item?.option);
  }

  private getDescuento(item: any): number | null {
    return this.parseNumber(item?.descuento ?? item?.Descuento ?? item?.discount ?? item?.Discount ?? null);
  }

  private getRecargo(item: any): number | null {
    return this.parseNumber(item?.recargo ?? item?.Recargo ?? item?.surcharge ?? item?.Surcharge ?? null);
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
      { key: 'cantidad', header: 'Cantidad', sortable: false, class: 'text-center', width: '110px' },
      { key: 'precioUnit', header: 'Precio unit.', sortable: false, class: 'text-end text-nowrap', width: '140px' }
    ];

    if (this.shouldShowPrecioOriginal()) {
      base.push({ key: 'precioOriginal', header: 'Original', sortable: false, class: 'text-end text-nowrap', width: '140px' });
    }

    base.push(
      { key: 'horas', header: 'Horas', sortable: false, class: 'text-center', width: '100px' },
      { key: 'personal', header: 'Personal', sortable: false, class: 'text-center', width: '110px' },
      { key: 'subtotal', header: 'Subtotal', sortable: false, class: 'text-end text-nowrap', width: '140px' },
      { key: 'notas', header: 'Notas', sortable: false, filterable: false, width: '280px' },
      { key: 'quitar', header: 'Quitar', sortable: false, filterable: false, class: 'text-center', width: '90px' }
    );

    this.selectedPaquetesColumns = base;
  }
}
