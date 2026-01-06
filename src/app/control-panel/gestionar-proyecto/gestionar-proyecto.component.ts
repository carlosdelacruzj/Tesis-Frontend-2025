import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
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
    { key: 'proyectoNombre', header: 'Proyecto', sortable: true, width: '30%' },
    { key: 'pedidoId', header: 'Pedido', sortable: true, class: 'text-center', width: '120px' },
    { key: 'responsableId', header: 'Resp.', sortable: true, class: 'text-center', width: '110px' },
    { key: 'fechas', header: 'Fechas', sortable: false, width: '180px' },
    { key: 'estadoNombre', header: 'Estado', sortable: true, class: 'text-center', width: '100px' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, class: 'text-center', width: '120px' }
  ];

  proyectos: Proyecto[] = [];
  estados: Array<{ estadoId: number; estadoNombre: string }> = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';

  form: UntypedFormGroup = this.fb.group({
    proyectoNombre: ['', Validators.required],
    pedidoId: [null, [Validators.required, Validators.min(1)]],
    fechaInicioEdicion: [''],
    fechaFinEdicion: [''],
    estadoId: [1, [Validators.required, Validators.min(1)]],
    responsableId: [null],
    notas: [''],
    enlace: [''],
    multimedia: [null],
    edicion: [null]
  });

  modal: ModalState = { open: false, guardando: false, titulo: '', editId: null };
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: UntypedFormBuilder,
    private readonly proyectoService: ProyectoService,
    private readonly router: Router
  ) {}

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

  abrirCrear(): void {
    this.form.reset({
      proyectoNombre: '',
      pedidoId: null,
      fechaInicioEdicion: '',
      fechaFinEdicion: '',
      estadoId: 1,
      responsableId: null,
      notas: '',
      enlace: '',
      multimedia: null,
      edicion: null
    });
    this.modal = { open: true, guardando: false, titulo: 'Nuevo proyecto', editId: null };
  }

  abrirEditar(row: Proyecto): void {
    this.modal = { open: true, guardando: false, titulo: 'Editar proyecto', editId: row.proyectoId };
    this.form.patchValue({
      proyectoNombre: row.proyectoNombre,
      pedidoId: row.pedidoId,
      fechaInicioEdicion: this.toDateInput(row.fechaInicioEdicion),
      fechaFinEdicion: this.toDateInput(row.fechaFinEdicion),
      estadoId: row.estadoId ?? 1,
      responsableId: row.responsableId,
      notas: row.notas,
      enlace: row.enlace,
      multimedia: row.multimedia,
      edicion: row.edicion
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

    const peticion = this.modal.editId
      ? this.proyectoService.actualizarProyecto(this.modal.editId, payload)
      : this.proyectoService.crearProyecto(payload);

    peticion.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        void Swal.fire({
          icon: 'success',
          title: this.modal.editId ? 'Proyecto actualizado' : 'Proyecto creado',
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

  private toDateInput(valor: string | null): string {
    if (!valor) return '';
    return valor.toString().slice(0, 10);
  }

  getEstadoNombre(id: number | null | undefined): string {
    if (id == null) return '—';
    const found = this.estados.find(e => e.estadoId === id);
    return found?.estadoNombre ?? String(id);
  }

  private loadEstados(): void {
    this.proyectoService.getEstados()
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
