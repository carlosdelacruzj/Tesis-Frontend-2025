import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { CatalogosService } from 'src/app/shared/services/catalogos.service';
import { Proyecto, ProyectoPayload } from './model/proyecto.model';
import { ProyectoService } from './service/proyecto.service';

interface ModalState {
  open: boolean;
  guardando: boolean;
  titulo: string;
  editId: number | null;
}

@Component({
  selector: 'app-gestionar-proyecto',
  templateUrl: './gestionar-proyecto.component.html',
  styleUrls: ['./gestionar-proyecto.component.css']
})
export class GestionarProyectoComponent implements OnInit, OnDestroy {
  columns: TableColumn<Proyecto>[] = [
    { key: 'proyectoNombre', header: 'Proyecto', sortable: true, width: '28%' },
    { key: 'pedidoCodigo', header: 'Pedido', sortable: true, class: 'text-center', width: '120px' },
    { key: 'evento', header: 'Evento', sortable: true, width: '180px' },
    { key: 'postproduccion', header: 'Post', sortable: false, width: '170px' },
    { key: 'estadoNombre', header: 'Estado', sortable: true, class: 'text-center', width: '110px' },
    { key: 'pago', header: 'Pago', sortable: true, class: 'text-center', width: '140px' },
    { key: 'pendientes', header: 'Pendientes', sortable: true, class: 'text-center', width: '110px' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, class: 'text-center', width: '90px' }
  ];

  proyectos: Proyecto[] = [];
  estados: { id: number; nombre: string }[] = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';
  estadoFilter = 'todos';
  pagoFilter = 'todos';
  pendientesFilter = 'todos';

  private readonly fb = inject(UntypedFormBuilder);
  private readonly proyectoService = inject(ProyectoService);
  private readonly catalogos = inject(CatalogosService);
  private readonly router = inject(Router);

  form: UntypedFormGroup = this.fb.group({
    pedidoId: [null, [Validators.required, Validators.min(1)]],
    responsableId: [null],
    notas: [''],
    enlace: ['']
  });

  modal: ModalState = { open: false, guardando: false, titulo: '', editId: null };
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadProyectos();
    this.loadEstados();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
  }

  onEstadoFilterChange(value: string): void {
    this.estadoFilter = value;
  }

  onPagoFilterChange(value: string): void {
    this.pagoFilter = value;
  }

  onPendientesFilterChange(value: string): void {
    this.pendientesFilter = value;
  }

  get proyectosFiltrados(): Proyecto[] {
    const term = (this.searchTerm || '').toLowerCase().trim();
    const estado = this.estadoFilter;
    const pago = this.pagoFilter;
    const pendientes = this.pendientesFilter;
    const list = (this.proyectos || []).filter((row) => {
      if (estado !== 'todos' && (row.estadoNombre || '').toLowerCase() !== estado) return false;
      if (pago !== 'todos' && (row.estadoPagoNombre || '').toLowerCase() !== pago) return false;
      if (pendientes === 'con' && !row.tienePendientes) return false;
      if (pendientes === 'sin' && row.tienePendientes) return false;

      if (!term) return true;
      const hay = [
        row.proyectoNombre,
        row.codigo,
        row.pedidoCodigo,
        row.estadoNombre,
        row.estadoPagoNombre,
        row.ubicacion,
        row.lugar
      ]
        .filter(Boolean)
        .map(v => String(v).toLowerCase());
      return hay.some(v => v.includes(term));
    });

    return list.sort((a, b) => {
      const da = this.toDateValue(a.eventoFecha) ?? this.toDateValue(a.postproduccion?.fechaInicioEdicion) ?? this.toDateValue(a.createdAt);
      const db = this.toDateValue(b.eventoFecha) ?? this.toDateValue(b.postproduccion?.fechaInicioEdicion) ?? this.toDateValue(b.createdAt);
      return da - db;
    });
  }

  get totalProyectos(): number {
    return this.proyectos.length;
  }

  get totalEnEjecucion(): number {
    return this.proyectos.filter(p => (p.estadoNombre || '').toLowerCase() === 'en ejecucion').length;
  }

  get totalPlanificados(): number {
    return this.proyectos.filter(p => (p.estadoNombre || '').toLowerCase() === 'planificado').length;
  }

  get totalEntregados(): number {
    return this.proyectos.filter(p => (p.estadoNombre || '').toLowerCase() === 'entregado').length;
  }

  get totalPendientesPago(): number {
    return this.proyectos.filter(p => (p.estadoPagoNombre || '').toLowerCase() !== 'pagado' && (p.saldoPendiente ?? 0) > 0).length;
  }

  get totalPendientesDevolucion(): number {
    return this.proyectos.filter(p => (p.pendientesDevolucion ?? 0) > 0).length;
  }

  get estadosFiltro(): string[] {
    const set = new Set(this.proyectos.map(p => (p.estadoNombre || '').toLowerCase()).filter(Boolean));
    return Array.from(set);
  }

  get pagosFiltro(): string[] {
    const set = new Set(this.proyectos.map(p => (p.estadoPagoNombre || '').toLowerCase()).filter(Boolean));
    return Array.from(set);
  }


  abrirEditar(row: Proyecto): void {
    this.modal = { open: true, guardando: false, titulo: 'Editar proyecto', editId: row.proyectoId };
    this.form.patchValue({
      pedidoId: row.pedidoId,
      responsableId: row.responsableId,
      notas: row.notas,
      enlace: row.enlace
    });
  }

  cerrarModal(): void {
    if (this.modal.guardando) return;
    this.modal = { ...this.modal, open: false, editId: null };
  }

  irADetalle(row: Proyecto): void {
    if (!row?.proyectoId) return;
    void this.router.navigate(['/home/gestionar-proyecto', row.proyectoId]);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.form.value as ProyectoPayload;
    this.modal = { ...this.modal, guardando: true };

    if (!this.modal.editId) {
      this.modal = { ...this.modal, guardando: false };
      void Swal.fire({
        icon: 'info',
        title: 'Creacion automatica',
        text: 'Los proyectos se crean automaticamente desde el pedido.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const peticion = this.proyectoService.actualizarProyecto(this.modal.editId, payload);

    peticion.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        void Swal.fire({
          icon: 'success',
          title: 'Proyecto actualizado',
          confirmButtonText: 'Entendido'
        });
        this.cerrarModal();
        this.loadProyectos();
      },
      error: (err) => {
        console.error('[proyecto] guardar', err);
        this.modal = { ...this.modal, guardando: false };
        void Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: 'Revisa los datos e intenta nuevamente.',
          confirmButtonText: 'Entendido'
        });
      }
    });
  }

  private loadProyectos(): void {
    this.loading = true;
    this.error = null;
    this.proyectoService.getProyectos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.proyectos = Array.isArray(lista) ? lista : [];
          this.loading = false;
        },
        error: (err) => {
          console.error('[proyecto] lista', err);
          this.error = 'No pudimos cargar los proyectos.';
          this.proyectos = [];
          this.loading = false;
        }
      });
  }

  private toDateValue(value: string | null | undefined): number {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const parsed = new Date(value.replace(' ', 'T')).getTime();
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  }

  formatCalendarDate(value: string | null | undefined): string {
    if (!value) return '-';
    const trimmed = String(value).trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const parsed = new Date(trimmed.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return '-';
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getEstadoNombre(id: number | null | undefined): string {
    if (id == null) return '-';
    const found = this.estados.find(e => e.id === id);
    return found?.nombre ?? String(id);
  }

  private loadEstados(): void {
    this.catalogos.getEstadosProyecto()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: lista => {
          this.estados = Array.isArray(lista) ? lista : [];
        },
        error: err => {
          console.error('[proyecto] estados', err);
          this.estados = [];
        }
      });
  }
}

