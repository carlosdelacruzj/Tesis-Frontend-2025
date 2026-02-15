import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { Cliente, EstadoCliente } from './model/cliente.model';
import { ClienteService } from './service/cliente.service';
import { from, Subject, takeUntil } from 'rxjs';
import { environment } from 'src/environments/environment';

export type ClienteRow = Cliente & { cliente?: string };

interface TipoDocumento {
  id: number;
  codigo: string;
  nombre: string;
  tipoDato: 'N' | 'A';
  tamMin: number;
  tamMax: number;
  activo: number;
}

@Component({
  selector: 'app-gestionar-cliente',
  templateUrl: './gestionar-cliente.component.html',
  styleUrls: ['./gestionar-cliente.component.css']
})
export class GestionarClienteComponent implements OnInit, OnDestroy {
  private readonly clienteService = inject(ClienteService);
  private readonly http = inject(HttpClient);

  columns: TableColumn<ClienteRow>[] = [
    { key: 'codigo', header: 'Código', sortable: true, width: '120px', class: 'text-center text-nowrap' },
    { key: 'cliente', header: 'Cliente', sortable: true },
    { key: 'correo', header: 'Correo', sortable: true },
    { key: 'celular', header: 'Celular', sortable: true, class: 'text-nowrap' },
    { key: 'estadoCliente', header: 'Estado', sortable: true, width: '140px', class: 'text-center' },
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
  nombrePattern = '^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ ]{2,20}$';
  apellidoPattern = '^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ ]{2,30}$';
  docPattern = '^[0-9]{1}[0-9]{7}$';
  docMinLength = 8;
  docMaxLength = 8;
  docInputMode: 'text' | 'numeric' = 'numeric';
  docPatternMessage = 'Solo numeros (8 digitos)';
  celularPattern = '^[1-9]{1}[0-9]{6,8}$';
  correoPattern = '^[a-z]+[a-z0-9._]+@[a-z]+\\.[a-z.]{2,5}$';
  tiposDocumento: TipoDocumento[] = [];
  selectedTipoDocumento: TipoDocumento | null = null;
  isRucSelected = false;

  @ViewChild('createForm') createForm?: NgForm;
  @ViewChild('editForm') editForm?: NgForm;

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadEstados();
    this.loadClientes();
    this.loadTiposDocumento();
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
          this.selectedEstadoClienteId = this.selectedCliente?.idEstadoCliente ?? this.getEstadoIdByName(this.selectedCliente?.estadoCliente ?? null);
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
      tipoDocumentoId: this.selectedTipoDocumento?.id,
      razonSocial: this.isRucSelected ? form.value.razonSocial : null,
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

    const correoForm = (form.value.correo ?? '').toString();
    const celularForm = (form.value.celular ?? '').toString();
    const direccionForm = (form.value.direccion ?? '').toString();
    const nombreForm = (form.value.nombre ?? '').toString();
    const apellidoForm = (form.value.apellido ?? '').toString();

    const correoActual = (this.selectedCliente.correo ?? '').toString();
    const celularActual = (this.selectedCliente.celular ?? '').toString();
    const direccionActual = (this.selectedCliente.direccion ?? '').toString();
    const nombreActual = (this.selectedCliente.nombre ?? '').toString();
    const apellidoActual = (this.selectedCliente.apellido ?? '').toString();

    const esRuc = (this.selectedCliente.tipoDocumentoCodigo ?? '').toString().toUpperCase() === 'RUC';

    const currentEstadoId = this.selectedCliente.idEstadoCliente ?? this.getEstadoIdByName(this.selectedCliente.estadoCliente ?? null);
    const selectedEstadoId = this.selectedEstadoClienteId ?? currentEstadoId;
    const debeActualizarEstado = selectedEstadoId !== null && selectedEstadoId !== currentEstadoId;
    const hayCambios = correoForm !== correoActual
      || celularForm !== celularActual
      || direccionForm !== direccionActual
      || (esRuc && (nombreForm !== nombreActual || apellidoForm !== apellidoActual));

    if (!hayCambios && !debeActualizarEstado) {
      this.modalEditarOpen = false;
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

      const guardarEstadoSiCorresponde = (message: string): void => {
        if (!debeActualizarEstado) {
          this.onEditSuccess(message);
          return;
        }
        this.clienteService.actualizarEstadoCliente(this.selectedCliente!.idCliente, selectedEstadoId as number)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => this.onEditSuccess(message),
            error: (err) => {
              this.modalEditarSaving = false;
              const estadoMsg = err?.error?.message || 'No pudimos actualizar el estado.';
              this.modalEditarError = estadoMsg;
            }
          });
      };

      if (!hayCambios) {
        guardarEstadoSiCorresponde('Actualización exitosa');
        return;
      }

      const payload = {
        correo: correoForm,
        celular: celularForm,
        idCliente: this.selectedCliente.idCliente,
        direccion: direccionForm,
        ...(esRuc ? { nombre: nombreForm, apellido: apellidoForm } : {})
      };

      this.clienteService.putClienteById(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res: unknown) => {
            const response = res as { ok?: boolean; message?: string } | null;
            const isBackendError = !!response && response.ok === false;
            const msg = isBackendError
              ? (response?.message || 'Ocurrió un error, volver a intentar.')
              : 'Actualización exitosa';

            if (isBackendError) {
              this.modalEditarSaving = false;
              this.modalEditarError = msg;
              return;
            }
            guardarEstadoSiCorresponde(msg);
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
    this.onTipoDocumentoChange(null);
  }

  private createEmptyEditModel(cliente?: ClienteRow) {
    return {
      nombre: cliente?.nombre || '',
      apellido: cliente?.apellido || '',
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
    if (this.selectedCliente?.idEstadoCliente != null) {
      this.selectedEstadoClienteId = this.selectedCliente.idEstadoCliente;
    } else if (this.selectedCliente?.estadoCliente) {
      this.selectedEstadoClienteId = this.getEstadoIdByName(this.selectedCliente.estadoCliente);
    }
        },
        error: (err) => {
          console.error('[clientes] estados', err);
          this.estadosCliente = [];
        }
      });
  }

  private loadTiposDocumento(): void {
    this.http.get<TipoDocumento[]>(`${environment.baseUrl}/tipos-documento`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tipos) => {
          const activos = (tipos ?? []).filter(tipo => tipo.activo === 1);
          this.tiposDocumento = activos;
          this.onTipoDocumentoChange(null);
        },
        error: (err) => {
          console.error('[clientes] tipos-documento', err);
          this.tiposDocumento = [];
          this.onTipoDocumentoChange(null);
        }
      });
  }

  onTipoDocumentoChange(tipo: TipoDocumento | null): void {
    this.selectedTipoDocumento = tipo;
    this.isRucSelected = (tipo?.codigo ?? '').toUpperCase() === 'RUC';
    if (!tipo) {
      this.docPattern = '';
      this.docMinLength = 0;
      this.docMaxLength = 0;
      this.docInputMode = 'text';
      this.docPatternMessage = 'Formato invalido';
      this.createForm?.form.patchValue({
        razonSocial: '',
        nombre: '',
        apellido: '',
        correo: '',
        doc: '',
        celular: '',
        direccion: ''
      });
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

    this.createForm?.form.patchValue({
      razonSocial: '',
      nombre: '',
      apellido: '',
      correo: '',
      doc: '',
      celular: '',
      direccion: ''
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


  onSortChange(event: { key: string; direction: 'asc' | 'desc' | '' }): void {
    // Reservado para telemetría futura
    void event;
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    // Reservado para telemetría futura
    void event;
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
          this.rows = (clientes ?? []).map(cliente => this.withClienteDisplay(cliente as Cliente));
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

  private withClienteDisplay(cliente: Cliente): ClienteRow {
    const nombre = this.toOptionalString(cliente.nombre);
    const apellido = this.toOptionalString(cliente.apellido);
    const razonSocial = this.toOptionalString(cliente.razonSocial);
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ').trim();
    const etiqueta = razonSocial
      || nombreCompleto
      || nombre
      || apellido
      || cliente.codigoCliente
      || cliente.codigo
      || `Cliente #${cliente.idCliente}`;
    return { ...cliente, cliente: etiqueta };
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }
}
