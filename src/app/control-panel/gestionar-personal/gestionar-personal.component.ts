import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { Subject, takeUntil } from 'rxjs';

import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { PersonalService, Cargo } from './service/personal.service';
import { Empleado, EmpleadoUpdateDto } from './model/personal.model';

type EmpleadoRow = Empleado & { nombreCompleto: string };

type SortPayload = { key: string; direction: 'asc' | 'desc' | '' };
type PagePayload = { page: number; pageSize: number };

type ModalMode = 'view' | 'edit';

@Component({
  selector: 'app-gestionar-personal',
  templateUrl: './gestionar-personal.component.html',
  styleUrls: ['./gestionar-personal.component.css']
})
export class GestionarPersonalComponent implements OnInit, OnDestroy {
  columns: TableColumn<EmpleadoRow>[] = [
    { key: 'codigoEmpleado', header: 'ID', sortable: true, width: '90px', class: 'text-center text-nowrap' },
    { key: 'nombreCompleto', header: 'Nombre', sortable: true },
    { key: 'documento', header: 'DNI', sortable: true, width: '130px', class: 'text-nowrap text-center' },
    { key: 'cargo', header: 'Cargo', sortable: true },
    { key: 'estado', header: 'Estado', sortable: true, width: '140px', class: 'text-center text-nowrap' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '140px', class: 'text-center text-nowrap' }
  ];

  rows: EmpleadoRow[] = [];
  cargos: Cargo[] = [];
  selected: EmpleadoRow | null = null;

  loadingList = false;
  error: string | null = null;

  celularPattern = '^[1-9]{1}[0-9]{6,8}$';
  correoPattern = '^[\\w.+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';
  nombresPattern = '^[a-zA-Z ]{2,20}$';
  apellidoPattern = '^[a-zA-Z ]{2,30}$';
  docPattern = '^[0-9]{1}[0-9]{7}$';

  private readonly destroy$ = new Subject<void>();

  @ViewChild('createForm') createForm?: NgForm;

  modalCrearOpen = false;
  modalCrearLoading = false;
  modalCrearSaving = false;
  modalCrearError: string | null = null;

  modalEditarOpen = false;
  modalEditarLoading = false;
  modalEditarSaving = false;
  modalEditarError: string | null = null;

  modalVerOpen = false;
  modalVerLoading = false;
  modalVerError: string | null = null;

  nuevoEmpleado = {
    nombre: '',
    apellido: '',
    correo: '',
    celular: '',
    documento: '',
    direccion: '',
    autonomo: 1 as 1 | 2,
    idCargo: 0,
    idEstado: 1
  };

  constructor(
    private readonly personalService: PersonalService
  ) {}

  ngOnInit(): void {
    this.loadEmpleados();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToCreate(): void {
    this.modalCrearError = null;
    this.modalCrearOpen = true;
    this.modalCrearLoading = true;
    this.modalCrearSaving = false;
    this.nuevoEmpleado = {
      nombre: '',
      apellido: '',
      correo: '',
      celular: '',
      documento: '',
      direccion: '',
      autonomo: 1 as 1 | 2,
      idCargo: 0,
      idEstado: 1
    };
    this.loadCargosForCreate();
  }

  onSortChange(_: SortPayload): void {
    // Hook disponible para telemetría futura
  }

  onPageChange(_: PagePayload): void {
    // Hook disponible para telemetría futura
  }

  reload(): void {
    this.loadEmpleados();
  }

  verEmpleado(row: EmpleadoRow): void {
    this.modalVerError = null;
    this.modalVerOpen = true;
    this.modalVerLoading = true;
    this.selected = null;
    this.loadEmpleado(row.idEmpleado, 'view', row);
  }

  editarEmpleado(row: EmpleadoRow): void {
    this.modalEditarError = null;
    this.modalEditarOpen = true;
    this.modalEditarLoading = true;
    this.modalEditarSaving = false;
    this.selected = null;
    this.loadEmpleado(row.idEmpleado, 'edit', row);
    this.loadCargos();
  }

  UpdateEmpleado(empleadoForm: NgForm): void {
    if (!this.selected) {
      return;
    }

    const v = empleadoForm.value || {};
    const dto: EmpleadoUpdateDto = {
      idEmpleado: Number(v.ID ?? this.selected.idEmpleado),
      correo: v.Correo ?? this.selected.correo,
      celular: v.Celular ?? this.selected.celular,
      direccion: v.Direccion ?? this.selected.direccion,
      idEstado: v.Estado !== undefined && v.Estado !== null ? Number(v.Estado) : this.selected.idEstado
    };

    if (empleadoForm.invalid) {
      empleadoForm.control.markAllAsTouched();
      return;
    }

    this.modalEditarSaving = true;

    this.personalService.updateEmpleado(dto)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.modalEditarSaving = false;
          this.loadEmpleados();
          this.loadEmpleado(dto.idEmpleado, 'edit');
          Swal.fire({
            text: 'Se actualizó al empleado exitosamente',
            icon: 'success',
            showCancelButton: false,
            customClass: { confirmButton: 'btn btn-success' },
            buttonsStyling: false
          });
        },
        error: (err) => {
          console.error('[personal] update', err);
          this.modalEditarSaving = false;
          Swal.fire({
            text: 'Ocurrió un error, volver a intentar.',
            icon: 'warning',
            showCancelButton: false,
            customClass: { confirmButton: 'btn btn-warning' },
            buttonsStyling: false
          });
        }
      });
  }

  private loadEmpleados(): void {
    this.loadingList = true;
    this.error = null;

    this.personalService.getEmpleados()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (empleados) => {
          this.rows = (empleados ?? []).map((empleado) => ({
            ...empleado,
            nombreCompleto: `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`.trim()
          }));
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[personal] list', err);
          this.error = 'No pudimos cargar el personal.';
          this.rows = [];
          this.loadingList = false;
        }
      });
  }

  private loadEmpleado(id: number, mode: ModalMode = 'view', fallback?: EmpleadoRow): void {
    if (mode === 'edit') {
      this.modalEditarLoading = true;
      this.modalEditarError = null;
    } else {
      this.modalVerLoading = true;
      this.modalVerError = null;
    }

    this.personalService.getEmpleadoById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (empleado) => {
          this.selected = {
            ...empleado,
            nombreCompleto: `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`.trim()
          };
          if (mode === 'edit') {
            this.modalEditarLoading = false;
          } else {
            this.modalVerLoading = false;
          }
        },
        error: (err) => {
          console.error(`[personal] detalle ${mode}`, err);
          if (fallback) {
            this.selected = {
              ...fallback,
              nombreCompleto: `${fallback.nombre ?? ''} ${fallback.apellido ?? ''}`.trim()
            };
          }
          if (mode === 'edit') {
            this.modalEditarLoading = false;
            this.modalEditarError = 'No pudimos cargar los datos del empleado.';
          } else {
            this.modalVerLoading = false;
            this.modalVerError = 'No pudimos cargar los datos del empleado.';
          }
        }
      });
  }

  private loadCargos(): void {
    this.personalService.getCargos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cargos) => { this.cargos = cargos ?? []; },
        error: (err) => { console.error('[personal] cargos', err); }
      });
  }

  private loadCargosForCreate(): void {
    this.personalService.getCargos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cargos) => {
          this.cargos = cargos ?? [];
          this.modalCrearLoading = false;
        },
        error: (err) => {
          console.error('[personal] cargos create', err);
          this.modalCrearLoading = false;
          this.modalCrearError = 'No pudimos cargar la lista de cargos.';
        }
      });
  }

  onEditModalClosed(): void {
    this.modalEditarOpen = false;
    this.modalEditarLoading = false;
    this.modalEditarSaving = false;
    this.modalEditarError = null;
    this.selected = null;
  }

  closeEditModal(): void {
    if (this.modalEditarLoading || this.modalEditarSaving) {
      return;
    }
    this.modalEditarOpen = false;
  }

  onViewModalClosed(): void {
    this.modalVerOpen = false;
    this.modalVerLoading = false;
    this.modalVerError = null;
    this.selected = null;
  }

  closeViewModal(): void {
    if (this.modalVerLoading) {
      return;
    }
    this.modalVerOpen = false;
  }

  onCreateModalClosed(): void {
    this.modalCrearOpen = false;
    this.modalCrearLoading = false;
    this.modalCrearSaving = false;
    this.modalCrearError = null;
    this.createForm?.resetForm();
  }

  closeCreateModal(): void {
    if (this.modalCrearLoading || this.modalCrearSaving) {
      return;
    }
    this.modalCrearOpen = false;
  }

  submitCreate(form: NgForm): void {
    if (!form || this.modalCrearSaving) {
      return;
    }
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.modalCrearSaving = true;
    this.modalCrearError = null;

    const payload: Partial<Empleado> = {
      ...this.nuevoEmpleado,
      idCargo: Number(this.nuevoEmpleado.idCargo),
      idEstado: this.nuevoEmpleado.idEstado !== undefined ? Number(this.nuevoEmpleado.idEstado) : undefined,
      autonomo: Number(this.nuevoEmpleado.autonomo) as 1 | 2
    };

    this.personalService.createEmpleado(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.modalCrearSaving = false;
          Swal.fire({
            text: 'Registro exitoso',
            icon: 'success',
            showCancelButton: false,
            customClass: { confirmButton: 'btn btn-success' },
            buttonsStyling: false
          });
          this.createForm?.resetForm({
            nombre: '',
            apellido: '',
            correo: '',
            celular: '',
            documento: '',
            direccion: '',
            autonomo: 1,
            idCargo: 0,
            idEstado: 1
          });
          this.modalCrearOpen = false;
          this.loadEmpleados();
        },
        error: (err) => {
          console.error('[personal] create', err);
          this.modalCrearSaving = false;
          const msg = err?.error?.message || 'Ocurrió un error, volver a intentar.';
          this.modalCrearError = msg;
        }
      });
  }
}
