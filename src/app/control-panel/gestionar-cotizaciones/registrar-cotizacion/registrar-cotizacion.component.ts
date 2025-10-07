import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';

import { CotizacionItemPayload, CotizacionPayload } from '../model/cotizacion.model';
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
  selector: 'app-registrar-cotizacion',
  templateUrl: './registrar-cotizacion.component.html',
  styleUrls: ['./registrar-cotizacion.component.css']
})
export class RegistrarCotizacionComponent implements OnInit, AfterViewInit, OnDestroy {
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
  loading = false;

  private readonly destroy$ = new Subject<void>();

  @ViewChild('paquetesSort') paquetesSort!: MatSort;

  constructor(
    private readonly fb: UntypedFormBuilder,
    private readonly cotizacionService: CotizacionService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadCatalogos();
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

  submit(): void {
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
    const clienteContacto = (raw.clienteContacto ?? '').toString().trim();
    const fechaEvento = raw.fechaEvento;
    const ubicacion = (raw.ubicacion ?? '').toString().trim();
    const horasEstimadas = (raw.horasEstimadas ?? '').toString().trim();
    const descripcionBase = (raw.descripcion ?? '').toString().trim();
    const descripcion = descripcionBase || (clienteNombre ? `Solicitud de cotización de ${clienteNombre}` : 'Solicitud de cotización');
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

    this.loading = true;
    this.cotizacionService.createCotizacion(payload)
      .pipe(
        finalize(() => this.loading = false),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Cotización registrada correctamente.', 'Cerrar', { duration: 4000 });
          this.router.navigate(['/home/gestionar-cotizaciones']);
        },
        error: (err) => {
          console.error('[cotizacion] create', err);
          this.snackBar.open('No pudimos registrar la cotización.', 'Cerrar', { duration: 5000 });
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
              this.selectedServicioNombre = firstValido?.nombre ?? firstValido?.Servicio ?? firstValido?.descripcion ?? '';
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
      control?.setValue(this.totalSeleccion, { emitEvent: false });
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
