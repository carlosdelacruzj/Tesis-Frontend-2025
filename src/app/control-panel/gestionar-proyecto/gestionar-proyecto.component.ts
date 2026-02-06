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
    { key: 'proyectoNombre', header: 'Proyecto', sortable: true, width: '30%' },
    { key: 'pedidoId', header: 'Pedido', sortable: true, class: 'text-center', width: '120px' },
    { key: 'responsableId', header: 'Resp.', sortable: true, class: 'text-center', width: '110px' },
    { key: 'fechas', header: 'Fechas', sortable: false, width: '180px' },
    { key: 'estadoNombre', header: 'Estado', sortable: true, class: 'text-center', width: '100px' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, class: 'text-center', width: '120px' }
  ];

  proyectos: Proyecto[] = [];
  estados: { id: number; nombre: string }[] = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';

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

