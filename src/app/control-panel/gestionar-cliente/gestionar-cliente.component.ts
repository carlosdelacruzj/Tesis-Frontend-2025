import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { Cliente, EstadoCliente } from './model/cliente.model';
import { ClienteService } from './service/cliente.service';

import { from, Subject, takeUntil } from 'rxjs';

export interface ClienteRow extends Cliente { }

@Component({
  selector: 'app-gestionar-cliente',
  templateUrl: './gestionar-cliente.component.html',
  styleUrls: ['./gestionar-cliente.component.css']
})
export class GestionarClienteComponent implements OnInit, OnDestroy {

  columns: TableColumn<ClienteRow>[] = [
    { key: 'codigoCliente', header: 'Código', sortable: true, width: '120px', class: 'text-center text-nowrap' },
    { key: 'nombre', header: 'Nombre', sortable: true },
    { key: 'apellido', header: 'Apellido', sortable: true },
    { key: 'correo', header: 'Correo', sortable: true },
    { key: 'celular', header: 'Celular', sortable: true, class: 'text-nowrap' },
    { key: 'doc', header: 'Documento', sortable: true, width: '160px', class: 'text-nowrap' },
    { key: 'direccion', header: 'Dirección', sortable: true },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '120px', class: 'text-center text-nowrap' }
  ];

  rows: ClienteRow[] = [];
  searchTerm = '';
  loadingList = false;
  error: string | null = null;

  modalRegistroOpen = false;
  modalRegistroLoading = false;
  modalRegistroError: string | null = null;

  modalEditarOpen = false;
  modalEditarLoading = false;
  modalEditarSaving = false;
  modalEditarError: string | null = null;
  selectedCliente: ClienteRow | null = null;
  editFormModel = this.createEmptyEditModel();
  editUiReady = false;
  estadosCliente: EstadoCliente[] = [];
  selectedEstadoClienteId: number | null = null;
  nombrePattern = '^[a-zA-Z ]{2,20}$';
  apellidoPattern = '^[a-zA-Z ]{2,30}$';
  docPattern = '^[0-9]{1}[0-9]{7}$';
  celularPattern = '^[1-9]{1}[0-9]{6,8}$';
  correoPattern = '^[a-z]+[a-z0-9._]+@[a-z]+\\.[a-z.]{2,5}$';

  @ViewChild('createForm') createForm?: NgForm;
  @ViewChild('editForm') editForm?: NgForm;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly clienteService: ClienteService
  ) { }

  ngOnInit(): void {
    this.loadEstados();
    this.loadClientes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToCreate(): void {
    this.modalRegistroError = null;
    this.modalRegistroOpen = true;
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  editarCliente(row: ClienteRow): void {
    if (!row?.idCliente) {
      return;
    }

    this.modalEditarError = null;
    this.modalEditarOpen = true;
    this.modalEditarLoading = true;
    this.modalEditarSaving = false;
    this.selectedCliente = null;
    this.editFormModel = this.createEmptyEditModel();
    this.editUiReady = false; // <--- NUEVO
    this.selectedEstadoClienteId = null;

    this.clienteService.getByIdCliente(row.idCliente)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const cliente = (Array.isArray(response) ? response[0] : response) || row;
          this.selectedCliente = cliente as ClienteRow;
          this.editFormModel = this.createEmptyEditModel(this.selectedCliente);
          this.selectedEstadoClienteId = this.getEstadoIdByName(this.selectedCliente?.estadoCliente ?? null);
          this.modalEditarLoading = false;

          // Espera a que se pinte el form y recién habilita la UI
          setTimeout(() => {
            this.editForm?.form.markAsPristine();
            this.editForm?.form.markAsUntouched();
            this.editUiReady = true;  // <--- NUEVO (se habilita en otro tick)
          }, 0);
        },
        error: (err) => {
          console.error('[clientes] detalle', err);
          this.modalEditarLoading = false;
          this.modalEditarError = 'No pudimos obtener los datos del cliente.';
        }
      });
  }


  onModalClosed(): void {
    this.modalRegistroOpen = false;
    this.modalRegistroLoading = false;
    this.modalRegistroError = null;
    this.resetCreateFormState();
  }

  closeCreateModal(): void {
    if (this.modalRegistroLoading) {
      return;
    }
    this.resetCreateFormState();
    this.modalRegistroOpen = false;
  }

  submitCreate(form: NgForm): void {
    if (!form || this.modalRegistroLoading) {
      return;
    }
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.modalRegistroLoading = true;
    this.modalRegistroError = null;

    const payload = {
      nombre: form.value.nombre,
      apellido: form.value.apellido,
      correo: form.value.correo,
      numDoc: form.value.doc,
      celular: form.value.celular,
      direccion: form.value.direccion
    };

    this.clienteService.addCliente(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.modalRegistroLoading = false;
          Swal.fire({
            text: 'Registro exitoso',
            icon: 'success',
            showCancelButton: false,
            customClass: { confirmButton: 'btn btn-success' },
            buttonsStyling: false
          });
          this.resetCreateFormState();
          this.modalRegistroOpen = false;
          this.loadClientes();
        },
        error: (err) => {
          this.modalRegistroLoading = false;
          const msg = err?.error?.message || 'Ocurrió un error, volver a intentar.';
          this.modalRegistroError = msg;
        }
      });
  }

  onEditModalClosed(): void {
    this.modalEditarOpen = false;
    this.modalEditarLoading = false;
    this.modalEditarSaving = false;
    this.modalEditarError = null;
    this.selectedCliente = null;
    this.editFormModel = this.createEmptyEditModel();
    this.editForm?.resetForm();
    this.editUiReady = false; // <--- NUEVO
    this.selectedEstadoClienteId = null;
  }


  closeEditModal(): void {
    if (this.modalEditarLoading || this.modalEditarSaving) {
      return;
    }
    this.modalEditarOpen = false;
  }

  submitEdit(form: NgForm): void {
    if (!form || this.modalEditarSaving || !this.selectedCliente) {
      return;
    }
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    Swal.fire({
      title: 'Confirmar actualización',
      text: '¿Deseas guardar los cambios del cliente?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'Cancelar',
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-outline-secondary'
      },
      buttonsStyling: false
    }).then(result => {
      if (!result.isConfirmed) {
        return;
      }

      this.modalEditarSaving = true;
      this.modalEditarError = null;

      const payload = {
        correo: form.value.correo,
        celular: form.value.celular,
        idCliente: this.selectedCliente.idCliente,
        direccion: form.value.direccion
      };

      const currentEstadoId = this.getEstadoIdByName(this.selectedCliente.estadoCliente ?? null);
      const selectedEstadoId = this.selectedEstadoClienteId ?? currentEstadoId;
      const debeActualizarEstado = selectedEstadoId !== null && selectedEstadoId !== currentEstadoId;

      this.clienteService.putClienteById(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: any) => {
            const isBackendError = res && res.ok === false;
            const msg = isBackendError
              ? (res.message || 'Ocurrió un error, volver a intentar.')
              : 'Actualización exitosa';

            if (isBackendError) {
              this.modalEditarSaving = false;
              this.modalEditarError = msg;
              return;
            }

            if (debeActualizarEstado) {
              this.clienteService.actualizarEstadoCliente(this.selectedCliente.idCliente, selectedEstadoId as number)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: () => this.onEditSuccess(msg),
                  error: (err) => {
                    this.modalEditarSaving = false;
                    const estadoMsg = err?.error?.message || 'No pudimos actualizar el estado.';
                    this.modalEditarError = estadoMsg;
                  }
                });
            } else {
              this.onEditSuccess(msg);
            }
          },
          error: (err) => {
            this.modalEditarSaving = false;
            const msg = err?.error?.message || 'Ocurrió un error, volver a intentar.';
            this.modalEditarError = msg;
          }
        });
    });
  }

  private resetCreateFormState(): void {
    if (this.createForm) {
      this.createForm.resetForm();
      this.createForm.form.markAsPristine();
      this.createForm.form.markAsUntouched();
    }
  }

  private createEmptyEditModel(cliente?: ClienteRow) {
    return {
      correo: cliente?.correo || '',
      celular: cliente?.celular || '',
      direccion: cliente?.direccion || ''
    };
  }

  private onEditSuccess(message: string): void {
    this.modalEditarSaving = false;
    Swal.fire({
      text: message,
      icon: 'success',
      showCancelButton: false,
      customClass: {
        confirmButton: 'btn btn-success'
      },
      buttonsStyling: false
    });
    this.modalEditarOpen = false;
    this.loadClientes();
  }

  private loadEstados(): void {
    this.clienteService.getEstadosCliente()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (estados) => {
          this.estadosCliente = estados ?? [];
          if (this.selectedCliente?.estadoCliente) {
            this.selectedEstadoClienteId = this.getEstadoIdByName(this.selectedCliente.estadoCliente);
          }
        },
        error: (err) => {
          console.error('[clientes] estados', err);
          this.estadosCliente = [];
        }
      });
  }

  private getEstadoIdByName(nombre: string | null): number | null {
    if (!nombre) {
      return null;
    }
    const encontrado = this.estadosCliente.find(
      (estado) => estado.nombreEstadoCliente === nombre
    );
    return encontrado ? encontrado.idEstadoCliente : null;
  }

  onSortChange(_: { key: string; direction: 'asc' | 'desc' | '' }): void {
    // Reservado para telemetría futura
  }

  onPageChange(_: { page: number; pageSize: number }): void {
    // Reservado para telemetría futura
  }

  reload(): void {
    this.loadClientes();
  }

  private loadClientes(): void {
    this.loadingList = true;
    this.error = null;

    from(this.clienteService.getAllClientes())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (clientes) => {
          this.rows = (clientes ?? []) as ClienteRow[];
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[clientes] list', err);
          this.error = 'No pudimos cargar los clientes.';
          this.rows = [];
          this.loadingList = false;
        }
      });
  }
}
