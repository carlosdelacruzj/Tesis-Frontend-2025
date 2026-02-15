import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { Subject, takeUntil } from 'rxjs';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { PersonalService, Cargo } from './service/personal.service';
import { Empleado, EmpleadoUpdateDto } from './model/personal.model';
import { environment } from 'src/environments/environment';

interface EmpleadoRow extends Empleado {
  nombreCompleto: string;
}

interface TipoDocumento {
  id: number;
  codigo: string;
  nombre: string;
  tipoDato: 'N' | 'A';
  tamMin: number;
  tamMax: number;
  activo: number;
}

interface SortPayload {
  key: string;
  direction: 'asc' | 'desc' | '';
}

interface PagePayload {
  page: number;
  pageSize: number;
}

type ModalMode = 'view' | 'edit';

@Component({
  selector: 'app-gestionar-personal',
  templateUrl: './gestionar-personal.component.html',
  styleUrls: ['./gestionar-personal.component.css']
})
export class GestionarPersonalComponent implements OnInit, OnDestroy {
  columns: TableColumn<EmpleadoRow>[] = [
    { key: 'codigo', header: 'CÃ³digo', sortable: true, width: '120px', class: 'text-center text-nowrap' },
    { key: 'nombreCompleto', header: 'Nombre', sortable: true },
    { key: 'documento', header: 'DNI', sortable: true, width: '130px', class: 'text-nowrap text-center' },
    { key: 'cargo', header: 'Cargo', sortable: true },
    { key: 'estado', header: 'Estado', sortable: true, width: '140px', class: 'text-center text-nowrap' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '140px', class: 'text-center text-nowrap' }
  ];

  rows: EmpleadoRow[] = [];
  searchTerm = '';
  cargos: Cargo[] = [];
  selected: EmpleadoRow | null = null;
  private selectedEditSnapshot: {
    correo: string;
    celular: string;
    direccion: string;
    idEstado: 1 | 2;
  } | null = null;

  loadingList = false;
  error: string | null = null;

  celularPattern = '^[1-9]{1}[0-9]{6,8}$';
  correoPattern = '^[\\w.+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';
  nombresPattern = '^[a-zA-ZÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã± ]{2,20}$';
  apellidoPattern = '^[a-zA-ZÃÃ‰ÃÃ“ÃšÃœÃ‘Ã¡Ã©Ã­Ã³ÃºÃ¼Ã± ]{2,30}$';
  docPattern = '^[0-9]{1}[0-9]{7}$';
  docMinLength = 8;
  docMaxLength = 8;
  docInputMode: 'text' | 'numeric' = 'numeric';
  docPatternMessage = 'Solo numeros (8 digitos)';
  tiposDocumento: TipoDocumento[] = [];
  selectedTipoDocumento: TipoDocumento | null = null;

  getEstadoTexto(estado?: string, idEstado?: number): string {
    if (estado) return estado;
    if (idEstado === 1) return 'Activo';
    if (idEstado === 2) return 'Inactivo';
    return 'â€”';
  }

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
    autonomo: 0 as 0 | 1,
    idCargo: 0,
    idEstado: 1,
    tipoDocumentoId: null as number | null
  };

  private readonly personalService = inject(PersonalService);
  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.loadEmpleados();
    this.loadTiposDocumento();
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
      autonomo: 0 as 0 | 1,
      idCargo: 0,
      idEstado: 1,
      tipoDocumentoId: null
    };
    this.loadCargosForCreate();
    this.onTipoDocumentoChange(null);
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  onSortChange(event: SortPayload): void {
    // Hook disponible para telemetrÃ­a futura
    void event;
  }

  onPageChange(event: PagePayload): void {
    // Hook disponible para telemetrÃ­a futura
    void event;
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
    this.selectedEditSnapshot = null;
    this.loadEmpleado(row.idEmpleado, 'edit', row);
    this.loadCargos();
  }

  UpdateEmpleado(empleadoForm: NgForm): void {
    if (!this.selected) {
      return;
    }

    const v = empleadoForm.value || {};
    const idEmpleado = Number(v.ID ?? this.selected.idEmpleado);
    const correoActual = String(v.Correo ?? this.selected.correo ?? '').trim();
    const celularActual = String(v.Celular ?? this.selected.celular ?? '').trim();
    const direccionActual = String(v.Direccion ?? this.selected.direccion ?? '').trim();
    const idEstadoActual = (v.Estado !== undefined && v.Estado !== null
      ? Number(v.Estado)
      : this.selected.idEstado) as 1 | 2;
    const snapshot = this.selectedEditSnapshot ?? {
      correo: String(this.selected.correo ?? '').trim(),
      celular: String(this.selected.celular ?? '').trim(),
      direccion: String(this.selected.direccion ?? '').trim(),
      idEstado: this.selected.idEstado
    };

    const cambioDatos =
      correoActual !== snapshot.correo ||
      celularActual !== snapshot.celular ||
      direccionActual !== snapshot.direccion;
    const cambioEstado = idEstadoActual !== snapshot.idEstado;

    if (empleadoForm.invalid) {
      empleadoForm.control.markAllAsTouched();
      return;
    }

    if (!cambioDatos && !cambioEstado) {
      this.modalEditarOpen = false;
      return;
    }

    Swal.fire({
      title: 'Confirmar actualización',
      text: '¿Deseas guardar los cambios del empleado?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-outline-secondary'
      },
      buttonsStyling: false
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.modalEditarSaving = true;

      const actualizarEstadoSiCorresponde = (): void => {
        if (!cambioEstado) {
          this.onUpdateEmpleadoSuccess();
          return;
        }

        this.personalService.actualizarEstadoEmpleado(idEmpleado, idEstadoActual)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => this.onUpdateEmpleadoSuccess(),
            error: (err) => this.onUpdateEmpleadoError(err)
          });
      };

      if (!cambioDatos) {
        actualizarEstadoSiCorresponde();
        return;
      }

      const dto: EmpleadoUpdateDto = {
        idEmpleado,
        correo: correoActual,
        celular: celularActual,
        direccion: direccionActual
      };

      this.personalService.updateEmpleado(dto)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => actualizarEstadoSiCorresponde(),
          error: (err) => this.onUpdateEmpleadoError(err)
        });
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
            this.selectedEditSnapshot = {
              correo: String(empleado.correo ?? '').trim(),
              celular: String(empleado.celular ?? '').trim(),
              direccion: String(empleado.direccion ?? '').trim(),
              idEstado: empleado.idEstado
            };
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
            if (mode === 'edit') {
              this.selectedEditSnapshot = {
                correo: String(fallback.correo ?? '').trim(),
                celular: String(fallback.celular ?? '').trim(),
                direccion: String(fallback.direccion ?? '').trim(),
                idEstado: fallback.idEstado
              };
            }
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
    this.selectedEditSnapshot = null;
  }

  closeEditModal(): void {
    if (this.modalEditarLoading || this.modalEditarSaving) {
      return;
    }
    this.modalEditarOpen = false;
    this.selectedEditSnapshot = null;
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
    this.onTipoDocumentoChange(null);
  }

  closeCreateModal(): void {
    if (this.modalCrearLoading || this.modalCrearSaving) {
      return;
    }
    this.modalCrearOpen = false;
  }

  private onUpdateEmpleadoSuccess(): void {
    this.modalEditarSaving = false;
    this.modalEditarOpen = false;
    this.selected = null;
    this.selectedEditSnapshot = null;
    this.loadEmpleados();
    Swal.fire({
      text: 'Se actualizó al empleado exitosamente',
      icon: 'success',
      showCancelButton: false,
      customClass: { confirmButton: 'btn btn-success' },
      buttonsStyling: false
    });
  }

  private onUpdateEmpleadoError(err: unknown): void {
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
      idEstado: this.nuevoEmpleado.idEstado !== undefined ? Number(this.nuevoEmpleado.idEstado) as 1 | 2 : undefined,
      tipoDocumentoId: this.selectedTipoDocumento?.id,
      autonomo: this.nuevoEmpleado.autonomo
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
            autonomo: 0,
            idCargo: 0,
            idEstado: 1,
            tipoDocumentoId: null
          });
          this.onTipoDocumentoChange(null);
          this.modalCrearOpen = false;
          this.loadEmpleados();
        },
        error: (err) => {
          console.error('[personal] create', err);
          this.modalCrearSaving = false;
          const msg = err?.error?.message || 'OcurriÃ³ un error, volver a intentar.';
          this.modalCrearError = msg;
        }
      });
  }

  private loadTiposDocumento(): void {
    this.http.get<TipoDocumento[]>(`${environment.baseUrl}/tipos-documento`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tipos) => {
          const activos = (tipos ?? [])
            .filter((tipo) => tipo.activo === 1)
            .filter((tipo) => this.isTipoDocumentoPermitido(tipo));
          this.tiposDocumento = activos;
          this.onTipoDocumentoChange(null);
        },
        error: (err) => {
          console.error('[personal] tipos-documento', err);
          this.tiposDocumento = [];
          this.onTipoDocumentoChange(null);
        }
      });
  }

  isAutonomo(value: unknown): boolean {
    if (value == null) {
      return false;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    const normalized = String(value).trim().toUpperCase();
    return normalized === 'SI' || normalized === '1' || normalized === 'TRUE';
  }

  private isTipoDocumentoPermitido(tipo: TipoDocumento): boolean {
    const codigo = String(tipo.codigo ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const nombre = String(tipo.nombre ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (codigo === 'DNI') {
      return true;
    }
    if (codigo === 'CE' || codigo === 'CARNET_EXTRANJERIA') {
      return true;
    }
    return nombre.includes('CARNET') && nombre.includes('EXTRANJERIA');
  }

  onTipoDocumentoChange(tipo: TipoDocumento | null): void {
    this.selectedTipoDocumento = tipo;
    if (!tipo) {
      this.docPattern = '';
      this.docMinLength = 0;
      this.docMaxLength = 0;
      this.docInputMode = 'text';
      this.docPatternMessage = 'Formato invalido';
      return;
    }

    const min = Number(tipo.tamMin) || 1;
    const max = Number(tipo.tamMax) || min;
    const isNumeric = tipo.tipoDato === 'N';
    const quantifier = min === max ? `{${min}}` : `{${min},${max}}`;
    this.docPattern = isNumeric
      ? `^[0-9]${quantifier}$`
      : `^[a-zA-Z0-9]${quantifier}$`;
    this.docMinLength = min;
    this.docMaxLength = max;
    this.docInputMode = isNumeric ? 'numeric' : 'text';

    const label = isNumeric ? 'Solo numeros' : 'Solo letras y numeros';
    const range = min === max ? `${min}` : `${min}-${max}`;
    const unit = isNumeric ? 'digitos' : 'caracteres';
    this.docPatternMessage = `${label} (${range} ${unit})`;
  }
}

