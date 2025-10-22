import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, finalize, switchMap, takeUntil } from 'rxjs';

import { Cotizacion, CotizacionItemPayload, CotizacionPayload } from '../model/cotizacion.model';
import { CotizacionService } from '../service/cotizacion.service';
import { formatDisplayDate, formatIsoDate } from '../../../shared/utils/date-utils';
import { TableColumn } from 'src/app/components/table/table-base.component';
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

@Component({
  selector: 'app-editar-cotizacion',
  templateUrl: './editar-cotizacion.component.html',
  styleUrls: ['./editar-cotizacion.component.css']
})
export class EditarCotizacionComponent implements OnInit, OnDestroy {
  form: UntypedFormGroup = this.fb.group({
    clienteNombre: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(2)]],
    clienteContacto: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(6)]],
    fechaEvento: [{ value: null, disabled: true }, Validators.required],
    eventoSolicitado: [{ value: '', disabled: true }],
    ubicacion: [{ value: '', disabled: true }, Validators.required],
    horasEstimadas: [{ value: '', disabled: true }],
    descripcion: [{ value: '', disabled: true }],
    totalEstimado: [0, Validators.min(0)]
  });

  servicios: any[] = [];
  eventos: any[] = [];
  selectedServicioId: number | null = null;
  selectedServicioNombre = '';
  selectedEventoId: number | null = null;
  selectedEventoNombre = '';

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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalSeleccion(): number {
    return this.selectedPaquetes.reduce((acc, item) => {
      const precio = Number(item.precio) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
      return acc + (precio * cantidad);
    }, 0);
  }

  onServicioChange(servicioId: number): void {
    this.selectedServicioId = servicioId ?? null;
    if (this.selectedServicioId == null) {
      this.selectedServicioNombre = '';
    } else {
      const selected = this.servicios.find(s => this.getId(s) === this.selectedServicioId);
      this.selectedServicioNombre = selected?.nombre ?? selected?.Servicio ?? selected?.descripcion ?? '';
    }
    this.loadEventosServicio();
  }

  onEventoChange(eventoId: number): void {
    this.selectedEventoId = eventoId ?? null;
    if (this.selectedEventoId == null) {
      this.selectedEventoNombre = '';
    } else {
      const selected = this.eventos.find(e => this.getId(e) === this.selectedEventoId);
      this.selectedEventoNombre = selected?.nombre ?? selected?.Evento ?? selected?.descripcion ?? '';
    }
    this.loadEventosServicio();
  }

  addPaquete(element: any): void {
    const key = this.getPkgKey(element);
    if (this.selectedPaquetes.some(p => p.key === key)) {
      return;
    }
    const eventoServicioId = this.getEventoServicioId(element);
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
    const ubicacion = (raw.ubicacion ?? '').toString().trim();

    const rawPayload = (this.cotizacion.raw as CotizacionPayload | undefined);
    const rawContacto = rawPayload?.contacto;
    const rawDetalle = rawPayload?.cotizacion;
    const rawContexto = rawPayload?.contexto;
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

    const payload: CotizacionPayload = {
      contacto: {
        nombre: clienteNombre,
        celular: clienteContacto,
        origen: rawContacto?.origen ?? 'Backoffice',
        correo: rawContacto?.correo
      },
      cotizacion: {
        idCotizacion: this.cotizacion.id,
        eventoId: this.selectedEventoId ?? rawDetalle?.eventoId,
        tipoEvento: this.selectedEventoNombre || rawContexto?.eventoNombre || rawDetalle?.tipoEvento || this.selectedServicioNombre,
        fechaEvento,
        lugar: ubicacion || rawDetalle?.lugar,
        horasEstimadas: horasEstimadasNumero,
        mensaje: descripcion,
        estado: rawDetalle?.estado ?? this.cotizacion.estado ?? 'Enviada',
        totalEstimado
      },
      items,
      contexto: {
        clienteId,
        servicioId: this.selectedServicioId ?? rawContexto?.servicioId,
        servicioNombre: this.selectedServicioNombre || rawContexto?.servicioNombre,
        eventoNombre: this.selectedEventoNombre || rawContexto?.eventoNombre,
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
          this.eventos = Array.isArray(eventos) ? eventos : [];
          if (!this.eventos.length) {
            this.selectedEventoId = null;
            this.selectedEventoNombre = '';
          }
          this.applyPendingSelections();
        },
        error: (err) => {
          console.error('[cotizacion] eventos', err);
          this.eventos = [];
          this.selectedEventoId = null;
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
    const fechaEventoDisplay = this.formatDateDisplay(this.fechaEventoOriginal);
    const horasTexto = contexto?.horasEstimadasTexto
      ?? (detalle?.horasEstimadas != null ? `${detalle.horasEstimadas} h` : '');

    this.form.patchValue({
      clienteNombre: nombre,
      clienteContacto: contacto,
      fechaEvento: fechaEventoDisplay,
      eventoSolicitado: cotizacion.eventoSolicitado ?? contexto?.eventoNombre ?? detalle?.tipoEvento ?? cotizacion.evento ?? '',
      ubicacion: detalle?.lugar ?? cotizacion.lugar ?? '',
      horasEstimadas: horasTexto,
      descripcion: detalle?.mensaje ?? cotizacion.notas ?? '',
      totalEstimado: detalle?.totalEstimado ?? cotizacion.total ?? 0
    }, { emitEvent: false });

    this.selectedPaquetes = (raw?.items ?? cotizacion.items ?? []).map((item, index) => {
      const horas = this.getHoras(item);
      const personal = this.getPersonal(item);
      const fotosImpresas = this.getFotosImpresas(item);
      const trailerMin = this.getTrailerMin(item);
      const filmMin = this.getFilmMin(item);
      const precioUnitario = Number((item as any)?.precio ?? item.precioUnitario ?? 0) || 0;
      const cantidad = Number(item.cantidad ?? 1) || 1;
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
        origen: item,
        precioOriginal: Number((item as any)?.precioOriginal ?? precioUnitario) || precioUnitario,
        editandoPrecio: false
      };
    });

    this.pendingServicioId = contexto?.servicioId && contexto.servicioId > 0 ? contexto.servicioId : null;
    this.pendingEventoId = detalle?.eventoId && detalle.eventoId > 0 ? detalle.eventoId : (cotizacion.eventoId ?? null);
    this.selectedServicioNombre = contexto?.servicioNombre ?? cotizacion.servicio ?? '';
    this.selectedEventoNombre = contexto?.eventoNombre ?? detalle?.tipoEvento ?? cotizacion.evento ?? '';

    this.syncTotalEstimado();
    this.applyPendingSelections();
  }

  private applyPendingSelections(): void {
    if (this.pendingServicioId != null) {
      const servicio = this.servicios.find(s => this.getId(s) === this.pendingServicioId);
      if (servicio) {
        this.selectedServicioId = this.pendingServicioId;
        this.selectedServicioNombre = servicio?.nombre ?? servicio?.Servicio ?? servicio?.descripcion ?? '';
      }
    } else if (!this.selectedServicioId && this.servicios.length) {
      // Mantiene la lista vacía hasta que se vincule un servicio manualmente
      this.selectedServicioId = null;
      this.selectedServicioNombre = '';
    }

    if (this.pendingEventoId != null) {
      const evento = this.eventos.find(e => this.getId(e) === this.pendingEventoId);
      if (evento) {
        this.selectedEventoId = this.pendingEventoId;
        this.selectedEventoNombre = evento?.nombre ?? evento?.Evento ?? evento?.descripcion ?? '';
      }
    } else if (!this.selectedEventoId && this.eventos.length) {
      this.selectedEventoId = null;
      this.selectedEventoNombre = '';
    }

    this.loadEventosServicio();
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

  private formatDateDisplay(value: string | Date | null | undefined): string {
    return formatDisplayDate(value, '');
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

  private getId(item: any): number | null {
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
