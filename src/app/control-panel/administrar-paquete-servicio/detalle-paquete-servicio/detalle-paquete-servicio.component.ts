import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { Evento, EventoServicioDetalle, Servicio } from '../model/evento-servicio.model';
import { EventoServicioDataService } from '../service/evento-servicio-data.service';

@Component({
  selector: 'app-paquete-servicio-detalle',
  templateUrl: './detalle-paquete-servicio.component.html',
  styleUrls: ['./detalle-paquete-servicio.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetallePaqueteServicioComponent implements OnInit, OnDestroy {
  evento: Evento | null = null;
  paquetes: EventoServicioDetalle[] = [];
  selectedPaquete: EventoServicioDetalle | null = null;
  servicios: Servicio[] = [];
  searchTerm = '';

  loadingEvento = false;
  loadingPaquetes = false;
  totalPaquetes = 0;
  totalStaff = 0;

  modalOpen = false;
  modalSaving = false;
  modalError: string | null = null;
  modalModo: 'crear' | 'editar' = 'crear';
  paqueteEditando: EventoServicioDetalle | null = null;

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    servicio: [null as number | null, Validators.required],
    categoria: [''],
    precio: [null as number | null],
    descripcion: [''],
    horas: [null as number | null],
    fotosImpresas: [null as number | null],
    trailerMin: [null as number | null],
    filmMin: [null as number | null]
  });

  columns: TableColumn<EventoServicioDetalle>[] = [
    { key: 'titulo', header: 'Título', sortable: true },
    { key: 'servicio.nombre', header: 'Servicio', sortable: true },
    { key: 'categoria', header: 'Categoría', sortable: true },
    { key: 'precio', header: 'Precio', sortable: true, class: 'text-end', width: '130px' },
    { key: 'horas', header: 'Horas', sortable: true, class: 'text-center', width: '90px' },
    { key: 'staff.total', header: 'Staff', sortable: true, class: 'text-center', width: '110px' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, class: 'text-center', width: '120px' }
  ];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dataService: EventoServicioDataService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const eventoId = Number(params.get('eventoId'));
        if (eventoId) {
          this.cargarEvento(eventoId);
          this.cargarPaquetes(eventoId);
          this.cargarServicios();
        } else {
          this.router.navigate(['/home/administrar-paquete-servicio']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  regresarAlListado(): void {
    this.router.navigate(['/home/administrar-paquete-servicio']);
  }

  abrirModalCrear(): void {
    if (!this.evento?.id) return;
    this.modalModo = 'crear';
    this.modalError = null;
    this.paqueteEditando = null;
    this.form.reset({
      titulo: '',
      servicio: this.servicios.length === 1 ? this.servicios[0].id : null,
      categoria: '',
      precio: null,
      descripcion: '',
      horas: null,
      fotosImpresas: null,
      trailerMin: null,
      filmMin: null
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalOpen = true;
  }

  abrirModalEditar(paquete: EventoServicioDetalle): void {
    this.modalModo = 'editar';
    this.modalError = null;
    this.paqueteEditando = paquete;
    this.form.reset({
      titulo: paquete.titulo,
      servicio: paquete.servicio?.id ?? null,
      categoria: paquete.categoria,
      precio: paquete.precio,
      descripcion: paquete.descripcion,
      horas: paquete.horas,
      fotosImpresas: paquete.fotosImpresas,
      trailerMin: paquete.trailerMin,
      filmMin: paquete.filmMin
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalOpen = true;
  }

  onRowClick(paquete: EventoServicioDetalle): void {
    this.selectedPaquete = paquete;
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  cerrarModal(): void {
    if (this.modalSaving) return;
    this.modalOpen = false;
    this.modalError = null;
    this.paqueteEditando = null;
  }

  guardarPaquete(): void {
    if (this.form.invalid || !this.evento?.id) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      servicio: this.form.value.servicio!,
      evento: this.evento.id,
      titulo: (this.form.value.titulo || '').trim(),
      categoria: this.form.value.categoria?.trim() || null,
      precio: this.form.value.precio ?? null,
      descripcion: this.form.value.descripcion?.trim() || null,
      horas: this.form.value.horas ?? null,
      fotosImpresas: this.form.value.fotosImpresas ?? null,
      trailerMin: this.form.value.trailerMin ?? null,
      filmMin: this.form.value.filmMin ?? null
    };

    this.modalSaving = true;
    const request$ = this.modalModo === 'crear'
      ? this.dataService.crearEventoServicio(payload)
      : this.dataService.actualizarEventoServicio(this.paqueteEditando!.id, payload);

    request$
      .pipe(finalize(() => {
        this.modalSaving = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          this.modalOpen = false;
          this.paqueteEditando = null;
          this.cargarPaquetes(this.evento!.id);
        },
        error: (err) => {
          console.error('Error guardando paquete', err);
          this.modalError = 'No pudimos guardar el paquete. Intenta nuevamente.';
        }
      });
  }

  private cargarEvento(id: number): void {
    this.loadingEvento = true;
    this.dataService.getEventoPorId(id)
      .pipe(finalize(() => {
        this.loadingEvento = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (evento) => {
          this.evento = evento;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando evento', err);
          this.evento = null;
          this.cdr.markForCheck();
        }
      });
  }

  private cargarPaquetes(eventoId: number): void {
    this.loadingPaquetes = true;
    this.dataService.getEventoServiciosFiltrado(eventoId)
      .pipe(finalize(() => {
        this.loadingPaquetes = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (detalle) => {
          this.paquetes = detalle ?? [];
          this.totalPaquetes = this.paquetes.length;
          this.totalStaff = this.paquetes.reduce(
            (acc, item) => acc + (item.staff?.detalle?.reduce((sum, st) => sum + st.cantidad, 0) ?? 0),
            0
          );
          if (this.paquetes.length) {
            this.selectedPaquete = this.paquetes[0];
          } else {
            this.selectedPaquete = null;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando paquetes', err);
          this.paquetes = [];
          this.totalPaquetes = 0;
          this.totalStaff = 0;
          this.selectedPaquete = null;
          this.cdr.markForCheck();
        }
      });
  }

  private cargarServicios(): void {
    this.dataService.getServicios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.servicios = lista ?? [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando servicios', err);
          this.servicios = [];
          this.cdr.markForCheck();
        }
      });
  }
}
