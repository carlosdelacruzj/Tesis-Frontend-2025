import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { Subject, takeUntil, firstValueFrom, take } from 'rxjs';
import { Cotizacion, CotizacionVersion } from './model/cotizacion.model';
import { CotizacionService } from './service/cotizacion.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { environment } from 'src/environments/environment';

interface TipoDocumento {
  id: number;
  codigo: string;
  nombre: string;
  tipoDato: 'N' | 'A';
  tamMin: number;
  tamMax: number;
  activo: number;
}

// TableBase
// Util: convertir assets a base64
@Component({
  selector: 'app-gestionar-cotizaciones',
  templateUrl: './gestionar-cotizaciones.component.html',
  styleUrls: ['./gestionar-cotizaciones.component.css'],
})
export class GestionarCotizacionesComponent implements OnInit, OnDestroy {
  private static readonly NOMBRE_PATTERN = '^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ ]{2,20}$';
  private static readonly APELLIDO_PATTERN = '^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ ]{2,30}$';
  private static readonly DOC_PATTERN = '^[0-9]{1}[0-9]{7}$';
  private static readonly CELULAR_PATTERN = '^[1-9]{1}[0-9]{6,8}$';
  private static readonly CORREO_PATTERN =
    '^[a-z]+[a-z0-9._]+@[a-z]+\\.[a-z.]{2,5}$';

  columns: TableColumn<Cotizacion>[] = [
    {
      key: 'codigo',
      header: 'Código',
      sortable: true,
      width: '120px',
      class: 'text-center text-nowrap',
    },
    {
      key: 'cliente',
      header: 'Cliente',
      sortable: true,
      width: '180px',
      class: 'cliente-col text-center',
    },
    { key: 'evento', header: 'Evento', sortable: true, width: '180px' },
    {
      key: 'fecha',
      header: 'Fecha del evento',
      sortable: true,
      width: '180px',
    },
    {
      key: 'createdAt',
      header: 'Fecha de creación',
      sortable: true,
      width: '160px',
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      width: '140px',
      class: 'text-center',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      sortable: false,
      filterable: false,
      width: '270px',
      class: 'text-center',
    },
  ];

  rows: Cotizacion[] = [];
  searchTerm = '';

  loadingList = false;
  downloadingId: number | null = null;
  error: string | null = null;

  estadoTarget: Cotizacion | null = null;
  estadoDestino: 'Enviada' | 'Aceptada' | 'Rechazada' | '' = '';

  registroClienteModalOpen = false;
  registroClienteLoading = false;
  registroClienteError: string | null = null;
  registroClienteFormModel = this.createRegistroClienteFormModel();

  readonly registroNombrePattern =
    GestionarCotizacionesComponent.NOMBRE_PATTERN;
  readonly registroApellidoPattern =
    GestionarCotizacionesComponent.APELLIDO_PATTERN;
  registroDocPattern = GestionarCotizacionesComponent.DOC_PATTERN;
  registroDocMinLength = 8;
  registroDocMaxLength = 8;
  registroDocInputMode: 'text' | 'numeric' = 'numeric';
  registroDocPatternMessage = 'Solo numeros (8 digitos)';
  readonly registroCelularPattern =
    GestionarCotizacionesComponent.CELULAR_PATTERN;
  readonly registroCorreoPattern =
    GestionarCotizacionesComponent.CORREO_PATTERN;
  tiposDocumento: TipoDocumento[] = [];
  selectedTipoDocumento: TipoDocumento | null = null;
  isRucSelected = false;

  versionesModalOpen = false;
  versionesModalLoading = false;
  versionesModalError: string | null = null;
  versionesTarget: Cotizacion | null = null;
  versionesRows: CotizacionVersion[] = [];
  versionDownloadingId: number | null = null;

  private readonly destroy$ = new Subject<void>();
  private registroClienteClosingInterno = false;
  private leadConversionPending = false;
  private leadConversionTarget: Cotizacion | null = null;
  private leadConversionDestino: 'Enviada' | 'Aceptada' | 'Rechazada' | '' = '';
  private clienteCreadoEnAceptacion = false;

  @ViewChild('createForm') registroClienteForm?: NgForm;
  private readonly cotizacionService = inject(CotizacionService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.loadCotizaciones();
    this.loadTiposDocumento();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToCreate(): void {
    this.router.navigate(['/home/gestionar-cotizaciones/registrar']);
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  ver(row: Cotizacion): void {
    void row;
  }

  editCotizacion(cotizacion: Cotizacion): void {
    if (
      cotizacion.estado === 'Aceptada' ||
      cotizacion.estado === 'Rechazada' ||
      cotizacion.estado === 'Expirada'
    ) {
      this.error =
        'No puedes editar una Cotización que ya fue aceptada, rechazada o expirada.';
      return;
    }
    this.router.navigate([
      '/home/gestionar-cotizaciones/editar',
      cotizacion.id,
    ]);
  }

  // === DESCARGAR PDF usando el SERVICE ===
  async downloadPdf(cotizacion: Cotizacion): Promise<void> {
    this.error = null;
    this.downloadingId = cotizacion.id;

    try {
      const versionId = cotizacion.cotizacionVersionVigenteId;
      if (!versionId) {
        throw new Error('La cotización no tiene versión vigente para descargar PDF.');
      }

      const blob = await firstValueFrom(
        this.cotizacionService.downloadPdfByVersionId(versionId),
      );

      this.downloadBlob(
        blob,
        `${cotizacion.codigo ?? 'cotizacion'}-${cotizacion.id}-v${cotizacion.cotizacionVersionVigente ?? 'vigente'}.pdf`,
      );
    } catch (err) {
      console.error('[cotizacion] pdf', err);
      this.error =
        'No se pudo descargar el PDF de la versión vigente. Revisa que exista cotizacionVersionVigenteId y que /api/v1/cotizaciones-versiones/:id/pdf responda correctamente.';
    } finally {
      this.downloadingId = null;
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const fileUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(fileUrl);
  }

  async openEstadoModal(
    cotizacion: Cotizacion,
    destino: 'Enviada' | 'Aceptada' | 'Rechazada',
  ): Promise<void> {
    this.error = null;
    if (!cotizacion || !cotizacion.total || cotizacion.total <= 0) {
      this.error =
        'La Cotización debe tener un total mayor a cero para cambiar de estado.';
      return;
    }

    this.estadoTarget = cotizacion;
    const estadoActual = (cotizacion.estado ?? 'Borrador').toString().trim();

    if (estadoActual === 'Enviada') {
      const selected = await this.seleccionarEstadoDesdeEnviada(cotizacion);
      if (!selected) {
        this.closeEstadoModal();
        return;
      }
      this.estadoDestino = selected;
      this.confirmEstadoChange();
      return;
    }

    const confirm = await this.fireSwal({
      icon: 'question',
      title: 'Confirmar cambio de estado',
      text: `Marcar ${cotizacion.codigo ?? `Cotización #${cotizacion.id}`} como enviada.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) {
      this.closeEstadoModal();
      return;
    }

    this.estadoDestino = destino;
    this.confirmEstadoChange();
  }

  private async seleccionarEstadoDesdeEnviada(
    cotizacion: Cotizacion,
  ): Promise<'Aceptada' | 'Rechazada' | null> {
    let seleccionado: 'Aceptada' | 'Rechazada' | null = null;
    await this.fireSwal({
      icon: 'question',
      title: 'Actualizar estado',
      text: `Selecciona el nuevo estado para ${cotizacion.codigo ?? `Cotización #${cotizacion.id}`}.`,
      html: `
        <div style="display:flex;justify-content:center;gap:10px;margin-top:8px;">
          <button id="swal-estado-aceptar" type="button" class="btn btn-primary">Aceptar cotización</button>
          <button id="swal-estado-rechazar" type="button" class="btn btn-danger">Rechazar cotización</button>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: {
        actions: 'd-flex justify-content-center',
        cancelButton: 'btn btn-outline-secondary',
      },
      didOpen: () => {
        const popup = Swal.getPopup();
        const aceptarBtn = popup?.querySelector(
          '#swal-estado-aceptar',
        ) as HTMLButtonElement | null;
        const rechazarBtn = popup?.querySelector(
          '#swal-estado-rechazar',
        ) as HTMLButtonElement | null;

        aceptarBtn?.addEventListener('click', () => {
          seleccionado = 'Aceptada';
          Swal.close();
        });
        rechazarBtn?.addEventListener('click', () => {
          seleccionado = 'Rechazada';
          Swal.close();
        });
      },
    });
    return seleccionado;
  }

  openVersionesModal(cotizacion: Cotizacion): void {
    this.versionesTarget = cotizacion;
    this.versionesModalOpen = true;
    this.versionesModalLoading = true;
    this.versionesModalError = null;
    this.versionesRows = [];

    this.cotizacionService
      .getCotizacionVersiones(cotizacion.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.versionesModalLoading = false;
          this.versionesRows = Array.isArray(rows) ? rows : [];
        },
        error: (err) => {
          console.error('[cotizacion] versiones', err);
          this.versionesModalLoading = false;
          this.versionesModalError =
            'No pudimos cargar las versiones de la cotización.';
        },
      });
  }

  closeVersionesModal(): void {
    this.versionesModalOpen = false;
    this.versionesModalLoading = false;
    this.versionesModalError = null;
    this.versionesTarget = null;
    this.versionesRows = [];
    this.versionDownloadingId = null;
  }

  verVersionPdf(version: CotizacionVersion): void {
    const versionId = version?.id;
    if (!versionId) {
      return;
    }
    this.versionDownloadingId = versionId;
    this.cotizacionService
      .downloadPdfByVersionId(versionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.versionDownloadingId = null;
          const url = URL.createObjectURL(blob);
          const opened = window.open(url, '_blank');
          if (!opened) {
            this.downloadBlob(
              blob,
              `cotizacion-${version.cotizacionId}-v${version.version}.pdf`,
            );
          } else {
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        },
        error: (err) => {
          this.versionDownloadingId = null;
          console.error('[cotizacion] version pdf', err);
          this.error =
            'No se pudo abrir el PDF de la versión seleccionada.';
        },
      });
  }

  showHistorialButton(cotizacion: Cotizacion): boolean {
    const version = Number(cotizacion?.cotizacionVersionVigente ?? 0);
    return Number.isFinite(version) && version > 1;
  }

  descargarVersionPdf(version: CotizacionVersion): void {
    const versionId = version?.id;
    if (!versionId) {
      return;
    }
    this.versionDownloadingId = versionId;
    this.cotizacionService
      .downloadPdfByVersionId(versionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.versionDownloadingId = null;
          this.downloadBlob(
            blob,
            `cotizacion-${version.cotizacionId}-v${version.version}.pdf`,
          );
        },
        error: (err) => {
          this.versionDownloadingId = null;
          console.error('[cotizacion] version download', err);
          this.error =
            'No se pudo descargar el PDF de la versión seleccionada.';
        },
      });
  }

  closeEstadoModal(): void {
    this.estadoDestino = '';
    this.estadoTarget = null;
  }

  confirmEstadoChange(): void {
    if (!this.estadoTarget || !this.estadoDestino) {
      this.closeEstadoModal();
      return;
    }

    if (!this.estadoTarget.total || this.estadoTarget.total <= 0) {
      this.error =
        'La Cotización debe tener un total mayor a cero para cambiar de estado.';
      this.closeEstadoModal();
      return;
    }

    if (
      this.estadoDestino === 'Aceptada' &&
      this.esLead(this.estadoTarget) &&
      !this.leadConversionPending
    ) {
      this.leadConversionPending = true;
      this.openLeadRegistroModal(this.estadoTarget);
      return;
    }

    this.ejecutarCambioEstado();
  }

  private ejecutarCambioEstado(): void {
    const target = this.estadoTarget ?? this.leadConversionTarget;
    const destino = this.estadoDestino || this.leadConversionDestino;

    if (!target || !destino) {
      console.warn('[cotizaciones] ejecutarCambioEstado sin target/destino', {
        estadoTarget: this.estadoTarget,
        leadConversionTarget: this.leadConversionTarget,
        estadoDestinoActual: this.estadoDestino,
        leadConversionDestino: this.leadConversionDestino,
      });
      return;
    }

    this.estadoTarget = target;
    this.estadoDestino = destino as typeof this.estadoDestino;
    if (destino !== 'Aceptada') {
      this.clienteCreadoEnAceptacion = false;
    }

    const id = target.id;
    const estadoActual = target.estado ?? 'Borrador';

    this.leadConversionPending = false;

    this.cotizacionService
      .updateEstado(id, destino, estadoActual)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (actualizada) => {
          this.error = null;
          if (actualizada) {
            this.rows = this.rows.map((item) =>
              item.id === actualizada.id
                ? this.mergeCotizacion(item, actualizada)
                : item,
            );
            this.rows = [...this.rows];
            if (this.estadoTarget && this.estadoTarget.id === actualizada.id) {
              this.estadoTarget = this.mergeCotizacion(
                this.estadoTarget,
                actualizada,
              );
            }
            if (
              this.leadConversionTarget &&
              this.leadConversionTarget.id === actualizada.id
            ) {
              this.leadConversionTarget = this.mergeCotizacion(
                this.leadConversionTarget,
                actualizada,
              );
            }

            if (destino === 'Aceptada') {
              // TODO: reemplazar el empleadoId fijo y enviar nombrePedido cuando tengamos esos datos.
              this.cotizacionService
                .createPedidoDesdeCotizacion(actualizada.id, { empleadoId: 1 })
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: ({ pedidoId }) => {
                    const baseTexto = pedidoId
                      ? `Pedido #${pedidoId} creado correctamente.`
                      : 'Pedido creado correctamente.';
                    const texto = this.clienteCreadoEnAceptacion
                      ? `Nuevo cliente registrado y Cotización aceptada. ${baseTexto}`
                      : `Cotización aceptada. ${baseTexto}`;
                    this.fireSwal({
                      icon: 'success',
                      title: 'Proceso completado',
                      text: texto,
                    });
                    this.clienteCreadoEnAceptacion = false;
                  },
                  error: (err) => {
                    console.error('[cotizaciones] migrar a pedido falló', err);
                    this.fireSwal({
                      icon: 'error',
                      title: 'No pudimos crear el pedido',
                      text: err?.message ?? 'Intenta nuevamente más tarde.',
                    });
                    this.clienteCreadoEnAceptacion = false;
                  },
                });
            } else {
              let title = 'Estado actualizado';
              let text = 'La Cotización se actualizó correctamente.';
              switch (destino) {
                case 'Enviada':
                  title = 'Cotización enviada';
                  text = 'La Cotización se marcó como enviada correctamente.';
                  break;
                case 'Rechazada':
                  title = 'Cotización rechazada';
                  text = 'La Cotización se marcó como rechazada correctamente.';
                  break;
              }
              this.fireSwal({ icon: 'success', title, text });
            }
          } else {
            this.clienteCreadoEnAceptacion = false;
            this.loadCotizaciones();
          }
          this.closeEstadoModal();
          this.estadoTarget = null;
          this.leadConversionTarget = null;
          this.estadoDestino = '';
          this.leadConversionDestino = '';

          this.cotizacionService
            .getCotizacion(id)
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe({
              next: (detalle) => {},
              error: (err) => {
                console.error(
                  '[cotizaciones] getCotizacion error al obtener detalle actualizado',
                  err,
                );
              },
            });
        },
        error: (err) => {
          console.error('[cotizacion] updateEstado', err);
          console.error('[cotizaciones] updateEstado payload fallido', {
            id,
            destino,
            estadoActual,
          });
          this.error =
            'No pudimos actualizar el estado. Verifica e intenta nuevamente.';
          this.closeEstadoModal();
          this.leadConversionDestino = '';
        },
      });
  }

  onSortChange(evt: { key: string; direction: 'asc' | 'desc' | '' }): void {
    void evt;
  }
  onPageChange(evt: { page: number; pageSize: number }): void {
    void evt;
  }

  reload(): void {
    this.loadCotizaciones();
  }

  private loadCotizaciones(): void {
    this.loadingList = true;
    this.error = null;

    this.cotizacionService
      .listCotizaciones()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cotizaciones) => {
          this.rows = (cotizaciones ?? []).map((c) =>
            this.withClienteDisplay(c),
          );
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[cotizaciones] list', err);
          this.error = 'No pudimos cargar las cotizaciones.';
          this.loadingList = false;
        },
      });
  }

  private createRegistroClienteFormModel(
    initial?: Partial<RegistroClienteFormModel>,
  ): RegistroClienteFormModel {
    return {
      razonSocial: '',
      nombre: '',
      apellido: '',
      correo: '',
      doc: '',
      celular: '',
      direccion: '',
      ...initial,
    };
  }

  private openLeadRegistroModal(cotizacion: Cotizacion): void {
    this.leadConversionTarget = cotizacion;
    this.leadConversionDestino = this.estadoDestino;
    const contacto = cotizacion.contacto ?? null;
    const nombreCompleto = (contacto?.nombre ?? cotizacion.cliente ?? '')
      .toString()
      .trim();
    const partesNombre = nombreCompleto
      ? nombreCompleto.split(/\s+/).filter(Boolean)
      : [];
    const nombre = partesNombre.shift() ?? '';
    const apellido = partesNombre.join(' ');

    const celularSanitizado = this.sanitizarCelular(
      contacto?.celular ?? cotizacion.contactoResumen ?? '',
    );

    this.onTipoDocumentoChange(null);
    this.registroClienteFormModel = this.createRegistroClienteFormModel({
      nombre,
      apellido,
      correo: contacto?.correo ?? '',
      celular: celularSanitizado,
    });
    this.registroClienteError = null;
    this.registroClienteLoading = false;
    this.registroClienteModalOpen = true;
    setTimeout(() => this.registroClienteForm?.form?.markAsPristine?.());
  }

  cancelLeadRegistroModal(): void {
    this.leadConversionPending = false;
    this.leadConversionTarget = null;
    this.leadConversionDestino = '';
    this.closeLeadRegistroModal(false);
    if (this.estadoTarget) {
      const target = this.estadoTarget;
      this.estadoDestino = '';
      void this.openEstadoModal(target, 'Aceptada');
    } else {
      this.closeEstadoModal();
    }
  }

  closeLeadRegistroModal(resetEstado = false, marcarInterno = true): void {
    if (marcarInterno) {
      this.registroClienteClosingInterno = true;
    }
    this.registroClienteModalOpen = false;
    this.registroClienteLoading = false;
    this.registroClienteError = null;
    this.registroClienteForm?.resetForm();
    this.registroClienteFormModel = this.createRegistroClienteFormModel();
    this.onTipoDocumentoChange(null);

    if (resetEstado) {
      this.estadoDestino = '';
      this.estadoTarget = null;
      this.leadConversionTarget = null;
      this.leadConversionDestino = '';
    }
  }

  onLeadRegistroClosed(): void {
    if (this.registroClienteClosingInterno) {
      this.registroClienteClosingInterno = false;
      return;
    }

    this.leadConversionPending = false;
    this.leadConversionTarget = null;
    this.leadConversionDestino = '';
    this.closeLeadRegistroModal(false, false);
    if (this.estadoTarget) {
      const target = this.estadoTarget;
      this.estadoDestino = '';
      void this.openEstadoModal(target, 'Aceptada');
    } else {
      this.closeEstadoModal();
    }
  }

  submitLeadRegistro(form: NgForm): void {
    if (this.registroClienteLoading) {
      return;
    }
    if (!form) {
      return;
    }
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    if (!this.selectedTipoDocumento) {
      this.registroClienteError = 'Selecciona un tipo de documento.';
      form.control.markAllAsTouched();
      return;
    }

    const target = this.estadoTarget ?? this.leadConversionTarget;
    const contactoId = target.contacto?.id ?? null;
    if (contactoId == null) {
      this.registroClienteError =
        'No pudimos identificar el lead asociado a la Cotización.';
      this.leadConversionPending = false;
      return;
    }

    const payload = {
      tipoDocumentoId: this.selectedTipoDocumento?.id,
      razonSocial: this.isRucSelected ? form.value.razonSocial : null,
      nombre: form.value.nombre,
      apellido: form.value.apellido,
      correo: form.value.correo,
      numDoc: form.value.doc,
      celular: form.value.celular,
      direccion: form.value.direccion,
    };

    this.registroClienteLoading = true;
    this.registroClienteError = null;

    this.cotizacionService
      .convertLeadToCliente(contactoId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          const response = resp as {
            usuarioAccion?: unknown;
            clienteAccion?: unknown;
          } | null;
          const usuarioAccion = response?.usuarioAccion;
          const clienteAccion = response?.clienteAccion;
          const acciones = [usuarioAccion, clienteAccion]
            .map((valor) => (valor ?? '').toString().trim().toUpperCase())
            .filter(Boolean);
          const conversionExitosa =
            !acciones.length ||
            acciones.every(
              (accion) => accion === 'CREADO' || accion === 'ACTUALIZADO',
            );

          if (!conversionExitosa) {
            console.warn(
              '[cotizaciones] convertLeadToCliente con estados inesperados',
              acciones,
            );
            this.registroClienteLoading = false;
            this.leadConversionPending = false;
            this.registroClienteError =
              'La respuesta del backend no confirma la conversión del lead.';
            return;
          }
          this.clienteCreadoEnAceptacion = true;
          this.registroClienteLoading = false;
          this.leadConversionPending = false;
          this.closeLeadRegistroModal(false);
          this.ejecutarCambioEstado();
        },
        error: (err) => {
          this.registroClienteLoading = false;
          this.clienteCreadoEnAceptacion = false;
          const msg =
            err?.error?.message ??
            'No pudimos registrar al cliente. Intenta nuevamente.';
          this.registroClienteError = msg;
          console.error('[cotizaciones] convertLeadToCliente error', err);
        },
      });
  }

  private sanitizarCelular(valor: string): string {
    if (!valor) {
      return '';
    }
    const digitos = valor.replace(/\D/g, '');
    if (digitos.length <= 9) {
      return digitos;
    }
    return digitos.slice(-9);
  }

  private loadTiposDocumento(): void {
    this.http
      .get<TipoDocumento[]>(`${environment.baseUrl}/tipos-documento`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tipos) => {
          const activos = (tipos ?? []).filter((tipo) => tipo.activo === 1);
          this.tiposDocumento = activos;
          this.onTipoDocumentoChange(null);
        },
        error: (err) => {
          console.error('[cotizaciones] tipos-documento', err);
          this.tiposDocumento = [];
          this.onTipoDocumentoChange(null);
        },
      });
  }

  onTipoDocumentoChange(tipo: TipoDocumento | null): void {
    this.selectedTipoDocumento = tipo;
    this.isRucSelected = (tipo?.codigo ?? '').toUpperCase() === 'RUC';
    if (!tipo) {
      this.registroDocPattern = '';
      this.registroDocMinLength = 0;
      this.registroDocMaxLength = 0;
      this.registroDocInputMode = 'text';
      this.registroDocPatternMessage = 'Formato invalido';
      return;
    }

    const min = Number(tipo.tamMin) || 1;
    const max = Number(tipo.tamMax) || min;
    const isNumeric = tipo.tipoDato === 'N';
    const quantifier = min === max ? `{${min}}` : `{${min},${max}}`;
    this.registroDocPattern = isNumeric
      ? `^[0-9]${quantifier}$`
      : `^[a-zA-Z0-9]${quantifier}$`;
    this.registroDocMinLength = min;
    this.registroDocMaxLength = max;
    this.registroDocInputMode = isNumeric ? 'numeric' : 'text';

    const label = isNumeric ? 'Solo numeros' : 'Solo letras y numeros';
    const range = min === max ? `${min}` : `${min}-${max}`;
    const unit = isNumeric ? 'digitos' : 'caracteres';
    this.registroDocPatternMessage = `${label} (${range} ${unit})`;
  }

  private esLead(cotizacion: Cotizacion | null): boolean {
    const contacto = cotizacion?.contacto ?? null;
    const origen = (contacto?.origen ?? '').toString().trim().toUpperCase();
    return origen === 'LEAD';
  }

  private mergeCotizacion(
    base: Cotizacion,
    actualizada: Cotizacion,
  ): Cotizacion {
    const contacto = actualizada.contacto ?? base.contacto;
    const contactoResumen = actualizada.contactoResumen ?? base.contactoResumen;
    const versionVigenteIdActualizada = Number(
      actualizada.cotizacionVersionVigenteId ?? NaN,
    );
    const versionVigenteActualizada = Number(
      actualizada.cotizacionVersionVigente ?? NaN,
    );
    const cotizacionVersionVigenteId =
      Number.isFinite(versionVigenteIdActualizada) &&
      versionVigenteIdActualizada > 0
        ? actualizada.cotizacionVersionVigenteId
        : base.cotizacionVersionVigenteId;
    const cotizacionVersionVigente =
      Number.isFinite(versionVigenteActualizada) && versionVigenteActualizada > 0
        ? actualizada.cotizacionVersionVigente
        : base.cotizacionVersionVigente;
    const total = actualizada.total ?? base.total;

    return this.withClienteDisplay({
      ...base,
      ...actualizada,
      contacto,
      contactoResumen,
      cotizacionVersionVigenteId,
      cotizacionVersionVigente,
      total,
    });
  }

  private withClienteDisplay(cotizacion: Cotizacion): Cotizacion {
    const { label, subtitle } = this.buildClienteDisplay(cotizacion);

    return {
      ...cotizacion,
      cliente: label,
      contactoResumen: subtitle || undefined,
    };
  }

  private buildClienteDisplay(cotizacion: Cotizacion): {
    label: string;
    subtitle?: string;
  } {
    const contacto = cotizacion.contacto ?? {};
    const nombre = this.toOptionalString(contacto.nombre);
    const apellido = this.toOptionalString(
      (contacto as { apellido?: unknown }).apellido,
    );
    const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ').trim();
    const clienteBase = this.toOptionalString(cotizacion.cliente);
    const contactoResumen = this.toOptionalString(cotizacion.contactoResumen);
    const celular = this.toOptionalString(contacto.celular);

    const etiqueta =
      nombreCompleto ||
      nombre ||
      clienteBase ||
      contactoResumen ||
      `Cliente #${contacto.id ?? cotizacion.id}`;

    const subtitulo =
      contactoResumen ||
      celular ||
      (nombre && clienteBase && nombre !== clienteBase
        ? clienteBase
        : undefined);

    return { label: etiqueta, subtitle: subtitulo };
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

  private fireSwal(options: Parameters<typeof Swal.fire>[0]): ReturnType<typeof Swal.fire> {
    const customClass = (options as { customClass?: Record<string, string> })?.customClass ?? {};
    const confirmColor = (options as { confirmButtonColor?: unknown })?.confirmButtonColor;
    const confirmColorText = (confirmColor ?? '').toString().toLowerCase();
    const isDangerConfirm =
      confirmColorText.includes('dc3545') ||
      confirmColorText.includes('b42318') ||
      confirmColorText.includes('danger');

    return Swal.fire({
      ...options,
      buttonsStyling: false,
      customClass: {
        confirmButton: customClass.confirmButton ?? (isDangerConfirm ? 'btn btn-danger' : 'btn btn-primary'),
        cancelButton: customClass.cancelButton ?? 'btn btn-outline-secondary',
        denyButton: customClass.denyButton ?? 'btn btn-danger',
        ...customClass,
      },
    });
  }
}

interface RegistroClienteFormModel {
  razonSocial: string;
  nombre: string;
  apellido: string;
  correo: string;
  doc: string;
  celular: string;
  direccion: string;
}
