import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { CotizacionItemPayload, CotizacionPayload, ClienteBusquedaResultado, CotizacionContextoPayload } from '../model/cotizacion.model';
import { CotizacionService } from '../service/cotizacion.service';
import { TableColumn } from 'src/app/components/table/table-base.component';

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
  selector: 'app-registrar-cotizacion',
  templateUrl: './registrar-cotizacion.component.html',
  styleUrls: ['./registrar-cotizacion.component.css']
})
export class RegistrarCotizacionComponent implements OnInit, OnDestroy {
  form: UntypedFormGroup = this.fb.group({
    clienteNombre: ['Cliente Demo', [Validators.required, Validators.minLength(2)]],
    clienteContacto: ['999999999', [Validators.required, Validators.minLength(6), Validators.pattern(/^[0-9]{6,15}$/)]],
    fechaEvento: [RegistrarCotizacionComponent.getTodayIsoDate(), Validators.required],
    ubicacion: ['Hotel Belmond', Validators.required],
    horasEstimadas: ['6 horas'],
    descripcion: ['Cobertura completa para evento demo'],
    totalEstimado: [0, Validators.min(0)]
  });

  servicios: any[] = [];
  eventos: any[] = [];
  selectedServicioId: number | null = null;
  selectedServicioNombre = '';
  selectedEventoId: number | null = null;
  selectedEventoNombre = '';
  clienteSearchControl = new UntypedFormControl('');
  clienteResultados: ClienteBusquedaResultado[] = [];
  clienteSearchLoading = false;
  clienteSearchError = '';
  clienteSeleccionado: ClienteBusquedaResultado | null = null;
  clienteBusquedaTermino = '';

  clienteDisplay = (cliente?: ClienteBusquedaResultado | string | null): string => {
    if (!cliente) {
      return '';
    }
    if (typeof cliente === 'string') {
      return cliente;
    }
    return this.resolveClienteNombre(cliente);
  };

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
  loading = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: UntypedFormBuilder,
    private readonly cotizacionService: CotizacionService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadCatalogos();
    this.initClienteBusqueda();
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
      this.selectedServicioNombre = this.getServicioNombre(selected);
    }
    this.loadEventosServicio();
  }

  onEventoChange(eventoId: number): void {
    this.selectedEventoId = eventoId ?? null;
    if (this.selectedEventoId == null) {
      this.selectedEventoNombre = '';
    } else {
      const selected = this.eventos.find(e => this.getId(e) === this.selectedEventoId);
      this.selectedEventoNombre = this.getEventoNombre(selected);
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
        grupo: grupo,
        opcion: opcion,
        personal: personal ?? undefined,
        horas: horas ?? undefined,
        fotosImpresas: fotosImpresas ?? undefined,
        trailerMin: trailerMin ?? undefined,
        filmMin: filmMin ?? undefined,
        descuento: descuento,
        recargo: recargo,
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

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Revisa los campos obligatorios.', 'Cerrar', { duration: 4000 });
      return;
    }

    if (!this.selectedPaquetes.length) {
      this.snackBar.open('Selecciona al menos un paquete para la cotizacion.', 'Cerrar', { duration: 4000 });
      return;
    }

    const raw = this.form.getRawValue();
    const clienteNombre = (raw.clienteNombre ?? '').toString().trim();
    const clienteContacto = this.sanitizeContacto((raw.clienteContacto ?? '').toString());
    const fechaEvento = raw.fechaEvento;
    const ubicacion = (raw.ubicacion ?? '').toString().trim();
    const horasEstimadas = (raw.horasEstimadas ?? '').toString().trim();
    const descripcionBase = (raw.descripcion ?? '').toString().trim();
    const descripcion = descripcionBase || (clienteNombre ? `Solicitud de cotizacion de ${clienteNombre}` : 'Solicitud de cotizacion');
    const horasEstimadasNumero = this.parseHorasToNumber(horasEstimadas);
    const totalEstimado = Number(raw.totalEstimado ?? this.totalSeleccion) || this.totalSeleccion;

    const items: CotizacionItemPayload[] = this.selectedPaquetes.map((item, index) => ({
      idEventoServicio: item.eventoServicioId ?? this.getEventoServicioId(item.origen) ?? undefined,
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

    const contexto: CotizacionContextoPayload = {};
    const clienteIdSeleccionado = this.parseNumber(this.clienteSeleccionado?.id);
    if (clienteIdSeleccionado != null) {
      contexto.clienteId = clienteIdSeleccionado;
    }
    if (this.selectedServicioId != null) {
      contexto.servicioId = this.selectedServicioId;
    }
    if (this.selectedServicioNombre) {
      contexto.servicioNombre = this.selectedServicioNombre;
    }
    if (this.selectedEventoNombre) {
      contexto.eventoNombre = this.selectedEventoNombre;
    }

    const payload: CotizacionPayload = {
      contacto: {
        nombre: clienteNombre,
        celular: clienteContacto,
        origen: 'Backoffice',
        correo: undefined
      },
      cotizacion: {
        eventoId: this.selectedEventoId ?? undefined,
        tipoEvento: this.selectedEventoNombre || this.selectedServicioNombre || 'Evento',
        fechaEvento,
        lugar: ubicacion || undefined,
        horasEstimadas: horasEstimadasNumero,
        mensaje: descripcion,
        estado: 'Borrador',
        totalEstimado
      },
      items,
      ...(Object.keys(contexto).length ? { contexto } : {})
    };

    console.log('[cotizacion] payload listo para enviar', payload);

    this.loading = true;
    this.cotizacionService.createCotizacion(payload)
      .pipe(
        finalize(() => this.loading = false),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Cotizacion registrada correctamente.', 'Cerrar', { duration: 4000 });
          this.router.navigate(['/home/gestionar-cotizaciones']);
        },
        error: (err) => {
          console.error('[cotizacion] create', err);
          this.snackBar.open('No pudimos registrar la cotizacion. Intentalo nuevamente.', 'Cerrar', { duration: 5000 });
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
        },
        error: (err) => {
          console.error('[cotizacion] servicios', err);
          this.servicios = [];
          this.selectedServicioId = null;
          this.selectedServicioNombre = '';
          this.loadingCatalogos = false;
          this.loadEventosServicio();
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
          } else {
            if (this.selectedEventoId == null) {
              const firstValido = this.eventos.find(item => this.getId(item) != null) || null;
              if (firstValido) {
                const id = this.getId(firstValido)!;
                this.selectedEventoId = id;
                this.selectedEventoNombre = this.getEventoNombre(firstValido);
              }
            } else {
              const selected = this.eventos.find(e => this.getId(e) === this.selectedEventoId);
              this.selectedEventoNombre = this.getEventoNombre(selected);
            }
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
    return item?.nombre ?? item?.Servicio ?? item?.descripcion ?? item?.Nombre ?? '';
  }

  private getEventoNombre(item: any): string {
    if (!item) {
      return '';
    }
    return item?.nombre ?? item?.Evento ?? item?.E_Nombre ?? item?.descripcion ?? item?.Nombre ?? '';
  }

  private static getTodayIsoDate(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
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
    if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
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
