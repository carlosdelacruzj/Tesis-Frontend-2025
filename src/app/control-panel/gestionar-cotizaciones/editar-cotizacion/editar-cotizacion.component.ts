import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject, finalize, switchMap, takeUntil } from 'rxjs';

import { Cotizacion, CotizacionItemPayload, CotizacionPayload } from '../model/cotizacion.model';
import { CotizacionService } from '../service/cotizacion.service';

interface PaqueteSeleccionado {
  key: string | number;
  descripcion: string;
  precio: number;
  staff?: number;
  horas?: number;
  notas?: string;
  origen?: any;
}

@Component({
  selector: 'app-editar-cotizacion',
  templateUrl: './editar-cotizacion.component.html',
  styleUrls: ['./editar-cotizacion.component.css']
})
export class EditarCotizacionComponent implements OnInit, AfterViewInit, OnDestroy {
  form: UntypedFormGroup = this.fb.group({
    clienteNombre: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(2)]],
    clienteContacto: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(6)]],
    fechaEvento: [{ value: null, disabled: true }, Validators.required],
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

  paquetesColumns = ['Descripcion', 'Precio', 'Staff', 'Horas', 'Seleccionar'];
  paquetesDataSource = new MatTableDataSource<any>([]);
  selectedPaquetes: PaqueteSeleccionado[] = [];

  loadingCatalogos = false;
  loadingPaquetes = false;
  loading = true;
  saving = false;

  private cotizacion: Cotizacion | null = null;
  private pendingServicioId: number | null = null;
  private pendingEventoId: number | null = null;

  private readonly destroy$ = new Subject<void>();

  @ViewChild('paquetesSort') paquetesSort!: MatSort;

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
  }

  ngAfterViewInit(): void {
    if (this.paquetesSort) {
      this.paquetesDataSource.sort = this.paquetesSort;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalSeleccion(): number {
    return this.selectedPaquetes.reduce((acc, item) => acc + (Number(item.precio) || 0), 0);
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
    this.selectedPaquetes = [
      ...this.selectedPaquetes,
      {
        key,
        descripcion: element?.descripcion ?? element?.Descripcion ?? 'Paquete',
        precio: Number(element?.precio ?? element?.Precio ?? 0),
        staff: Number(element?.staff ?? element?.Staff ?? 0) || undefined,
        horas: Number(element?.horas ?? element?.Horas ?? 0) || undefined,
        notas: '',
        origen: element
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
    const clienteNombre = (raw.clienteNombre ?? '').toString().trim();
    const horasEstimadas = (raw.horasEstimadas ?? '').toString().trim();
    const descripcionBase = (raw.descripcion ?? '').toString().trim();
    const descripcion = descripcionBase || (clienteNombre ? `Solicitud de cotización de ${clienteNombre}` : 'Solicitud de cotización');
    const clienteContacto = (raw.clienteContacto ?? '').toString().trim();
    const clienteId = (this.cotizacion.raw as CotizacionPayload)?.clienteId;
    const fechaEvento = raw.fechaEvento;
    const ubicacion = (raw.ubicacion ?? '').toString().trim();

    const items: CotizacionItemPayload[] = this.selectedPaquetes.map(item => ({
      descripcion: item.descripcion,
      cantidad: 1,
      precioUnitario: item.precio,
      notas: item.notas
    }));

    const payload: CotizacionPayload = {
      clienteNombre,
      clienteContacto,
      fechaEvento,
      ubicacion,
      horasEstimadas: horasEstimadas || undefined,
      descripcion,
      servicioId: this.selectedServicioId ?? undefined,
      servicioNombre: this.selectedServicioNombre || undefined,
      eventoId: this.selectedEventoId ?? undefined,
      eventoNombre: this.selectedEventoNombre || undefined,
      totalEstimado: Number(raw.totalEstimado ?? this.totalSeleccion) || this.totalSeleccion,
      items
    };

    if (clienteId != null) {
      payload.clienteId = clienteId;
    }

    this.saving = true;
    this.cotizacionService.updateCotizacion(this.cotizacion.id, payload)
      .pipe(
        finalize(() => this.saving = false),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Cotización actualizada.', 'Cerrar', { duration: 4000 });
          this.router.navigate(['/home/gestionar-cotizaciones']);
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

    const nombre = (raw?.clienteNombre ?? cotizacion.cliente ?? '').toString().trim();
    const contacto = (raw?.clienteContacto ?? cotizacion.contacto ?? '').toString().trim();

    this.form.patchValue({
      clienteNombre: nombre,
      clienteContacto: contacto,
      fechaEvento: raw?.fechaEvento ?? cotizacion.fecha ?? null,
      ubicacion: raw?.ubicacion ?? '',
      horasEstimadas: raw?.horasEstimadas ?? '',
      descripcion: raw?.descripcion ?? cotizacion.notas ?? '',
      totalEstimado: raw?.totalEstimado ?? cotizacion.total ?? 0
    }, { emitEvent: false });

    this.selectedPaquetes = (raw?.items ?? cotizacion.items ?? []).map(item => ({
      key: this.getPkgKey(item),
      descripcion: item.descripcion,
      precio: Number(item.precioUnitario ?? 0),
      notas: item.notas,
      horas: undefined,
      staff: undefined
    }));

    this.pendingServicioId = raw?.servicioId && raw.servicioId > 0 ? raw.servicioId : null;
    this.pendingEventoId = raw?.eventoId && raw.eventoId > 0 ? raw.eventoId : null;
    this.selectedServicioNombre = raw?.servicioNombre ?? cotizacion.servicio ?? '';
    this.selectedEventoNombre = raw?.eventoNombre ?? cotizacion.evento ?? '';

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
      this.paquetesDataSource.data = [];
      this.loadingPaquetes = false;
      return;
    }

    this.loadingPaquetes = true;
    this.cotizacionService.getEventosServicio(this.selectedEventoId, this.selectedServicioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: paquetes => {
          this.paquetesDataSource.data = paquetes ?? [];
          if (this.paquetesSort) {
            this.paquetesDataSource.sort = this.paquetesSort;
          }
          this.loadingPaquetes = false;
        },
        error: (err) => {
          console.error('[cotizacion] eventos-servicio', err);
          this.paquetesDataSource.data = [];
          this.loadingPaquetes = false;
        }
      });
  }

  private syncTotalEstimado(): void {
    const control = this.form.get('totalEstimado');
    if (!control?.dirty) {
      control?.setValue(this.totalSeleccion || control.value || 0, { emitEvent: false });
    }
  }

  private getId(item: any): number | null {
    if (!item) return null;
    const raw = item?.id ?? item?.ID ?? item?.pk ?? item?.PK_E_Cod;
    if (raw == null) return null;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  private getPkgKey(el: any): string {
    return String(el?.idEventoServicio ?? el?.ID ?? el?.PK_ExS_Cod ?? `${el?.descripcion}|${el?.precio}`);
  }

}
