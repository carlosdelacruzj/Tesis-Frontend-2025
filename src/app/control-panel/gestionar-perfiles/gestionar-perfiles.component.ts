import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { Empleado } from '../gestionar-personal/model/personal.model';
import { PersonalService } from '../gestionar-personal/service/personal.service';
import { ApiErrorResponse, PerfilCatalogo } from './model/perfil.model';
import { PerfilService } from './service/perfil.service';

export type PerfilRow = PerfilCatalogo;

type PerfilFormMode = 'create' | 'edit';

interface EmpleadoOption {
  idEmpleado: number;
  idUsuario: number;
  nombreCompleto: string;
  correo: string;
  cargo: string;
  estado: string;
}

@Component({
  selector: 'app-gestionar-perfiles',
  templateUrl: './gestionar-perfiles.component.html',
  styleUrls: ['./gestionar-perfiles.component.css']
})
export class GestionarPerfilesComponent implements OnInit, OnDestroy {

  columns: TableColumn<PerfilRow>[] = [
    { key: 'idPerfil', header: 'ID', sortable: true, width: '100px', class: 'text-center text-nowrap' },
    { key: 'codigo', header: 'Codigo', sortable: true, width: '140px', class: 'text-nowrap' },
    { key: 'nombre', header: 'Nombre', sortable: true },
    { key: 'descripcion', header: 'Descripcion', sortable: true },
    { key: 'activo', header: 'Estado', sortable: true, width: '120px', class: 'text-center text-nowrap' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '180px', class: 'text-center text-nowrap' }
  ];

  rows: PerfilRow[] = [];
  searchTerm = '';
  loadingList = false;
  savingPerfil = false;
  changingState = false;
  error: string | null = null;

  perfilModalOpen = false;
  perfilFormMode: PerfilFormMode = 'create';
  perfilCodigoActual = '';
  perfilForm = {
    codigo: '',
    nombre: '',
    descripcion: '',
    activo: true
  };

  asignarModalOpen = false;
  asignandoPerfil = false;
  loadingEmpleados = false;
  asignacionError: string | null = null;
  empleados: EmpleadoOption[] = [];
  empleadosFiltrados: EmpleadoOption[] = [];
  asignacionFormData = {
    perfilCodigo: '',
    empleadoId: null as number | null,
    principal: false,
    empleadoBusqueda: ''
  };

  private readonly destroy$ = new Subject<void>();

  private readonly perfilService = inject(PerfilService);
  private readonly personalService = inject(PersonalService);

  ngOnInit(): void {
    this.loadPerfiles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCreatePerfilForm(): void {
    this.perfilModalOpen = true;
    this.perfilFormMode = 'create';
    this.perfilCodigoActual = '';
    this.perfilForm = {
      codigo: '',
      nombre: '',
      descripcion: '',
      activo: true
    };
    this.error = null;
  }

  openEditPerfilForm(row: PerfilRow): void {
    if (!row?.codigo) {
      return;
    }

    this.perfilModalOpen = true;
    this.perfilFormMode = 'edit';
    this.perfilCodigoActual = row.codigo;
    this.perfilForm = {
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      activo: row.activo
    };
    this.error = null;
  }

  closePerfilForm(): void {
    if (this.savingPerfil) {
      return;
    }
    this.perfilModalOpen = false;
    this.error = null;
  }

  onPerfilModalClosed(): void {
    this.perfilModalOpen = false;
    this.error = null;
  }

  submitPerfilForm(): void {
    const codigo = String(this.perfilForm.codigo ?? '').trim();
    const nombre = String(this.perfilForm.nombre ?? '').trim();
    const descripcion = String(this.perfilForm.descripcion ?? '').trim();

    if (!codigo && this.perfilFormMode === 'create') {
      this.error = 'El codigo es obligatorio.';
      return;
    }

    if (!nombre) {
      this.error = 'El nombre es obligatorio.';
      return;
    }

    if (!descripcion) {
      this.error = 'La descripcion es obligatoria.';
      return;
    }

    this.savingPerfil = true;
    this.error = null;

    if (this.perfilFormMode === 'create') {
      this.perfilService.crearPerfil({ codigo, nombre, descripcion, activo: Boolean(this.perfilForm.activo) })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.savingPerfil = false;
            this.perfilModalOpen = false;
            this.loadPerfiles();
            void Swal.fire({ icon: 'success', text: res?.message ?? 'Perfil creado.', confirmButtonText: 'Ok' });
          },
          error: (err) => {
            this.savingPerfil = false;
            this.error = this.getErrorMessage(err) ?? 'No se pudo crear el perfil.';
          }
        });
      return;
    }

    this.perfilService.actualizarPerfil(this.perfilCodigoActual, { nombre, descripcion })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.savingPerfil = false;
          this.perfilModalOpen = false;
          this.loadPerfiles();
          void Swal.fire({ icon: 'success', text: res?.message ?? 'Perfil actualizado.', confirmButtonText: 'Ok' });
        },
        error: (err) => {
          this.savingPerfil = false;
          this.error = this.getErrorMessage(err) ?? 'No se pudo actualizar el perfil.';
        }
      });
  }

  togglePerfilEstado(row: PerfilRow): void {
    if (!row?.codigo || this.changingState) {
      return;
    }

    const nextEstado = !row.activo;
    const accion = nextEstado ? 'activar' : 'desactivar';

    void Swal.fire({
      icon: 'question',
      text: `¿Deseas ${accion} el perfil ${row.codigo}?`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.changingState = true;
      this.error = null;

      this.perfilService.cambiarEstadoPerfil(row.codigo, nextEstado)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.changingState = false;
            this.loadPerfiles();
            void Swal.fire({ icon: 'success', text: res?.message ?? 'Estado actualizado.', confirmButtonText: 'Ok' });
          },
          error: (err) => {
            this.changingState = false;
            this.error = this.getErrorMessage(err) ?? 'No se pudo actualizar el estado del perfil.';
          }
        });
    });
  }

  openAsignarPerfilModal(row: PerfilRow): void {
    if (!row?.codigo) {
      return;
    }

    this.asignacionFormData = {
      perfilCodigo: row.codigo,
      empleadoId: null,
      principal: false,
      empleadoBusqueda: ''
    };
    this.asignacionError = null;
    this.asignarModalOpen = true;

    if (this.empleados.length === 0) {
      this.loadEmpleados();
    } else {
      this.empleadosFiltrados = [...this.empleados];
    }
  }

  closeAsignarPerfilModal(): void {
    if (this.asignandoPerfil) {
      return;
    }
    this.asignarModalOpen = false;
    this.asignacionError = null;
  }

  onAsignarModalClosed(): void {
    this.asignarModalOpen = false;
    this.asignacionError = null;
  }

  onEmpleadoChange(selectedId: number | null): void {
    this.asignacionFormData.empleadoId = selectedId ? Number(selectedId) : null;
  }

  filtrarEmpleados(): void {
    const term = this.asignacionFormData.empleadoBusqueda.trim().toLowerCase();
    if (!term) {
      this.empleadosFiltrados = [...this.empleados];
      return;
    }

    this.empleadosFiltrados = this.empleados.filter((empleado) =>
      empleado.nombreCompleto.toLowerCase().includes(term)
      || empleado.cargo.toLowerCase().includes(term)
      || String(empleado.idEmpleado).includes(term)
    );
  }

  submitAsignacionPerfil(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    const empleadoId = Number(this.asignacionFormData.empleadoId);
    const perfilCodigo = String(this.asignacionFormData.perfilCodigo ?? '').trim();

    if (!Number.isFinite(empleadoId) || empleadoId <= 0) {
      this.asignacionError = 'Selecciona un empleado valido.';
      return;
    }

    const empleado = this.empleados.find((item) => item.idEmpleado === empleadoId);
    const usuarioId = Number(empleado?.idUsuario);
    if (!empleado || !Number.isFinite(usuarioId) || usuarioId <= 0) {
      this.asignacionError = 'No se pudo resolver el usuario del empleado seleccionado.';
      return;
    }

    if (!perfilCodigo) {
      this.asignacionError = 'Selecciona un perfil.';
      return;
    }

    this.asignandoPerfil = true;
    this.asignacionError = null;

    this.perfilService.asignarPerfilPorCodigo(usuarioId, perfilCodigo, Boolean(this.asignacionFormData.principal))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.asignandoPerfil = false;
          this.asignarModalOpen = false;
          void Swal.fire({
            icon: 'success',
            text: res?.message ?? 'Perfil asignado correctamente.',
            confirmButtonText: 'Ok'
          });
        },
        error: (err) => {
          this.asignandoPerfil = false;
          this.asignacionError = this.getErrorMessage(err) ?? 'No se pudo asignar el perfil.';
        }
      });
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  onSortChange(event: { key: string; direction: 'asc' | 'desc' | '' }): void {
    void event;
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    void event;
  }

  reload(): void {
    this.loadPerfiles();
  }

  private loadPerfiles(): void {
    this.loadingList = true;
    this.error = null;

    this.perfilService.getPerfiles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (perfiles) => {
          this.rows = perfiles ?? [];
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[perfiles] list', err);
          this.error = this.getErrorMessage(err) ?? 'No pudimos cargar los perfiles.';
          this.rows = [];
          this.loadingList = false;
        }
      });
  }

  private loadEmpleados(): void {
    this.loadingEmpleados = true;
    this.asignacionError = null;

    this.personalService.getEmpleados()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: Empleado[]) => {
          this.empleados = (res ?? [])
            .filter((empleado) => Number(empleado?.idUsuario) > 0 && Number(empleado?.esOperativoCampo) === 0)
            .map((empleado) => ({
              idEmpleado: Number(empleado.idEmpleado),
              idUsuario: Number(empleado.idUsuario),
              nombreCompleto: `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`.trim(),
              correo: String(empleado.correo ?? ''),
              cargo: String(empleado.cargo ?? ''),
              estado: String(empleado.estado ?? (Number(empleado.idEstado) === 1 ? 'Activo' : 'Inactivo'))
            }))
            .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

          this.empleadosFiltrados = [...this.empleados];
          this.loadingEmpleados = false;
        },
        error: (err) => {
          this.loadingEmpleados = false;
          this.asignacionError = this.getErrorMessage(err) ?? 'No se pudo cargar la lista de empleados.';
        }
      });
  }

  private getErrorMessage(err: unknown): string | null {
    const message = (err as { error?: ApiErrorResponse })?.error?.message;
    return typeof message === 'string' && message.trim().length > 0 ? message : null;
  }
}
