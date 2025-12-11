import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { Subject, takeUntil, firstValueFrom, take } from 'rxjs';

import { Cotizacion } from './model/cotizacion.model';
import { CotizacionService } from './service/cotizacion.service';

// TableBase
import { TableColumn } from 'src/app/components/table-base/table-base.component';

// Util: convertir assets a base64
import { urlToBase64 } from 'src/app/utils/url-to-base64';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

@Component({
  selector: 'app-gestionar-cotizaciones',
  templateUrl: './gestionar-cotizaciones.component.html',
  styleUrls: ['./gestionar-cotizaciones.component.css']
})
export class GestionarCotizacionesComponent implements OnInit, OnDestroy {
  private static readonly NOMBRE_PATTERN = '^[a-zA-Z ]{2,20}$';
  private static readonly APELLIDO_PATTERN = '^[a-zA-Z ]{2,30}$';
  private static readonly DOC_PATTERN = '^[0-9]{1}[0-9]{7}$';
  private static readonly CELULAR_PATTERN = '^[1-9]{1}[0-9]{6,8}$';
  private static readonly CORREO_PATTERN = '^[a-z]+[a-z0-9._]+@[a-z]+\\.[a-z.]{2,5}$';

      columns: TableColumn<Cotizacion>[] = [
    { key: "codigo", header: "Codigo", sortable: true, width: "120px", class: "text-center text-nowrap" },
    { key: "cliente", header: "Cliente", sortable: true, width: "180px", class: "cliente-col text-center" },
    { key: "evento", header: "Evento", sortable: true, width: "180px" },
    { key: "fecha", header: "Fecha / horas", sortable: true, width: "160px" },
    { key: "total", header: "Total", sortable: true, width: "140px", class: "text-center text-nowrap" },
    { key: "estado", header: "Estado", sortable: true, width: "140px", class: "text-center" },
    { key: "acciones", header: "Acciones", sortable: false, filterable: false, width: "160px", class: "text-center" }
  ];

  rows: Cotizacion[] = [];
  searchTerm = '';

  loadingList = false;
  downloadingId: number | null = null;
  error: string | null = null;

  estadoModalOpen = false;
  estadoTarget: Cotizacion | null = null;
  estadoDestino: 'Enviada' | 'Aceptada' | 'Rechazada' | '' = '';

  registroClienteModalOpen = false;
  registroClienteLoading = false;
  registroClienteError: string | null = null;
  registroClienteFormModel = this.createRegistroClienteFormModel();

  readonly registroNombrePattern = GestionarCotizacionesComponent.NOMBRE_PATTERN;
  readonly registroApellidoPattern = GestionarCotizacionesComponent.APELLIDO_PATTERN;
  readonly registroDocPattern = GestionarCotizacionesComponent.DOC_PATTERN;
  readonly registroCelularPattern = GestionarCotizacionesComponent.CELULAR_PATTERN;
  readonly registroCorreoPattern = GestionarCotizacionesComponent.CORREO_PATTERN;

  private readonly destroy$ = new Subject<void>();
  private registroClienteClosingInterno = false;
  private leadConversionPending = false;
  private leadConversionTarget: Cotizacion | null = null;
  private leadConversionDestino: 'Enviada' | 'Aceptada' | 'Rechazada' | '' = '';
  private clienteCreadoEnAceptacion = false;

  @ViewChild('registroClienteForm') registroClienteForm?: NgForm;

  constructor(
    private readonly cotizacionService: CotizacionService,
    private readonly router: Router,
    private readonly http: HttpClient
  ) { }

  ngOnInit(): void { this.loadCotizaciones(); }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  navigateToCreate(): void {
    this.router.navigate(['/home/gestionar-cotizaciones/registrar']);
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  ver(_row: Cotizacion) { /* opcional */ }

  editCotizacion(cotizacion: Cotizacion): void {
    if (cotizacion.estado === 'Aceptada' || cotizacion.estado === 'Rechazada') {
      this.error = 'No puedes editar una Cotización que ya fue aceptada o rechazada.';
      return;
    }
    this.router.navigate(['/home/gestionar-cotizaciones/editar', cotizacion.id]);
  }

  // === DESCARGAR PDF usando el SERVICE (NO HttpClient directo) ===
  async downloadPdf(cotizacion: Cotizacion): Promise<void> {
    this.error = null;
    this.downloadingId = cotizacion.id;

    try {
      // Assets a base64 (data URL). Ajusta nombres si cambian.
      const logoUrl = 'assets/images/logocot.jpg';
      const firmaUrl = 'assets/images/firma.png';

      const [logoDataUrl, firmaDataUrl] = await Promise.all([
        urlToBase64(this.http, logoUrl),
        urlToBase64(this.http, firmaUrl),
      ]);

      const payload = {
        company: {
          logoBase64: logoDataUrl,    // data:image/png;base64,...
          firmaBase64: firmaDataUrl,  // data:image/png;base64,...
        },
        videoEquipo: '35 mm y sistema 4K',
      };

      const blob = await firstValueFrom(
        this.cotizacionService.downloadPdf(cotizacion.id, payload)
      );

      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = `${cotizacion.codigo ?? 'cotizacion'}-${cotizacion.id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(fileUrl);
    } catch (err) {
      console.error('[cotizacion] pdf', err);
      this.error = 'No se pudo descargar el PDF. Revisa que /api/v1/cotizaciones/:id/pdf o el alias /api/cotizacion/:id/pdf respondan en el backend.';
    } finally {
      this.downloadingId = null;
    }
  }

  openEstadoModal(cotizacion: Cotizacion, destino: 'Enviada' | 'Aceptada' | 'Rechazada'): void {
    this.error = null;
    if (!cotizacion || !cotizacion.total || cotizacion.total <= 0) {
      this.error = 'La Cotización debe tener un total mayor a cero para cambiar de estado.';
      return;
    }

    this.estadoTarget = cotizacion;
    this.estadoDestino = destino;
    this.estadoModalOpen = true;
  }

  closeEstadoModal(): void {
    this.estadoModalOpen = false;
    this.estadoDestino = '';
    this.estadoTarget = null;
  }

  confirmEstadoChange(): void {
    if (!this.estadoTarget || !this.estadoDestino) {
      this.closeEstadoModal(); return;
    }

    if (!this.estadoTarget.total || this.estadoTarget.total <= 0) {
      this.error = 'La Cotización debe tener un total mayor a cero para cambiar de estado.';
      this.closeEstadoModal(); return;
    }

    if (this.estadoDestino === 'Aceptada' && this.esLead(this.estadoTarget) && !this.leadConversionPending) {
      this.leadConversionPending = true;
      this.estadoModalOpen = false;
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
        leadConversionDestino: this.leadConversionDestino
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

    console.debug('[cotizaciones] ejecutarCambioEstado -> updateEstado', {
      id,
      destino,
      estadoActual
    });

    this.cotizacionService.updateEstado(id, destino, estadoActual)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (actualizada) => {
          console.debug('[cotizaciones] updateEstado OK', actualizada);
          this.error = null;
          if (actualizada) {
            this.rows = this.rows.map(item =>
              item.id === actualizada.id ? this.mergeCotizacion(item, actualizada) : item
            );
            this.rows = [...this.rows];
            if (this.estadoTarget && this.estadoTarget.id === actualizada.id) {
              this.estadoTarget = this.mergeCotizacion(this.estadoTarget, actualizada);
            }
            if (this.leadConversionTarget && this.leadConversionTarget.id === actualizada.id) {
              this.leadConversionTarget = this.mergeCotizacion(this.leadConversionTarget, actualizada);
            }

            if (destino === 'Aceptada') {
              // TODO: reemplazar el empleadoId fijo y enviar nombrePedido cuando tengamos esos datos.
              this.cotizacionService.createPedidoDesdeCotizacion(actualizada.id, { empleadoId: 1 })
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: ({ pedidoId }) => {
                    console.debug('[cotizaciones] pedido creado desde Cotización', { pedidoId, cotizacionId: actualizada.id });
                    const baseTexto = pedidoId
                      ? `Pedido #${pedidoId} creado correctamente.`
                      : 'Pedido creado correctamente.';
                    const texto = this.clienteCreadoEnAceptacion
                      ? `Nuevo cliente registrado y Cotización aceptada. ${baseTexto}`
                      : `Cotización aceptada. ${baseTexto}`;
                    Swal.fire({
                      icon: 'success',
                      title: 'Proceso completado',
                      text: texto
                    });
                    this.clienteCreadoEnAceptacion = false;
                  },
                  error: err => {
                    console.error('[cotizaciones] migrar a pedido falló', err);
                    Swal.fire({
                      icon: 'error',
                      title: 'No pudimos crear el pedido',
                      text: err?.message ?? 'Intenta nuevamente mÃ¡s tarde.'
                    });
                    this.clienteCreadoEnAceptacion = false;
                  }
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
              Swal.fire({ icon: 'success', title, text });
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

          this.cotizacionService.getCotizacion(id)
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe({
              next: detalle => {
                console.log('[cotizaciones] getCotizacion detalle actualizado', detalle);
              },
              error: err => {
                console.error('[cotizaciones] getCotizacion error al obtener detalle actualizado', err);
              }
            });
        },
        error: (err) => {
          console.error('[cotizacion] updateEstado', err);
          console.error('[cotizaciones] updateEstado payload fallido', {
            id,
            destino,
            estadoActual
          });
          this.error = 'No pudimos actualizar el estado. Verifica e intenta nuevamente.';
          this.closeEstadoModal();
          this.leadConversionDestino = '';
        }
      });
    console.log('[cotizaciones] aceptar â€“ target completo', target);
    console.log('[cotizaciones] aceptar â€“ raw del backend', target.raw);
    console.log('[cotizaciones] aceptar â€“ contacto normalizado', target.contacto);
    console.log('[cotizaciones] aceptar â€“ destino', destino);
  }

  get estadoModalTitle(): string { return 'Confirmar cambio de estado'; }

  get estadoModalMessage(): string {
    if (!this.estadoTarget) return '';
    const nombre = this.estadoTarget.codigo ?? `Cotización #${this.estadoTarget.id}`;
    const estadoActual = this.estadoTarget.estado ?? 'Borrador';
    if (estadoActual === 'Borrador') return `Marcar ${nombre} como enviada.`;
    return `Selecciona el nuevo estado para ${nombre}. Estado actual: ${estadoActual}`;
  }

  onSortChange(_evt: { key: string; direction: 'asc' | 'desc' | '' }) { }
  onPageChange(_evt: { page: number; pageSize: number }) { }

  reload(): void { this.loadCotizaciones(); }

  private loadCotizaciones(): void {
    this.loadingList = true;
    this.error = null;

    this.cotizacionService.listCotizaciones()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cotizaciones) => {
          this.rows = (cotizaciones ?? []).map(c => this.withClienteDisplay(c));
          this.loadingList = false;
          console.log('[cotizaciones] list', cotizaciones);
        },
        error: (err) => {
          console.error('[cotizaciones] list', err);
          this.error = 'No pudimos cargar las cotizaciones.';
          this.loadingList = false;
        }
      });
  }

  private createRegistroClienteFormModel(initial?: Partial<RegistroClienteFormModel>): RegistroClienteFormModel {
    return {
      nombre: '',
      apellido: '',
      correo: '',
      numDoc: '',
      celular: '',
      direccion: '',
      ...initial
    };
  }

  private openLeadRegistroModal(cotizacion: Cotizacion): void {
    this.leadConversionTarget = cotizacion;
    this.leadConversionDestino = this.estadoDestino;
    const contacto = cotizacion.contacto ?? null;
    console.log('[cotizaciones] openLeadRegistroModal contacto', {
      cotizacionId: cotizacion?.id,
      contacto
    });
    const nombreCompleto = (contacto?.nombre ?? cotizacion.cliente ?? '').toString().trim();
    const partesNombre = nombreCompleto ? nombreCompleto.split(/\s+/).filter(Boolean) : [];
    const nombre = partesNombre.shift() ?? '';
    const apellido = partesNombre.join(' ');

    const celularSanitizado = this.sanitizarCelular(contacto?.celular ?? cotizacion.contactoResumen ?? '');

    this.registroClienteFormModel = this.createRegistroClienteFormModel({
      nombre,
      apellido,
      correo: contacto?.correo ?? '',
      celular: celularSanitizado
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
      this.estadoDestino = '';
      this.estadoModalOpen = true;
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
      this.estadoDestino = '';
      this.estadoModalOpen = true;
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

    const target = this.estadoTarget ?? this.leadConversionTarget;
    console.debug('[cotizaciones] submitLeadRegistro target', { target });
    const contactoId = target.contacto?.id ?? null;
    if (contactoId == null) {
      this.registroClienteError = 'No pudimos identificar el lead asociado a la Cotización.';
      this.leadConversionPending = false;
      return;
    }

    const payload = {
      nombre: form.value.nombre,
      apellido: form.value.apellido,
      correo: form.value.correo,
      numDoc: form.value.numDoc,
      celular: form.value.celular,
      direccion: form.value.direccion
    };

    this.registroClienteLoading = true;
    this.registroClienteError = null;

    this.cotizacionService.convertLeadToCliente(contactoId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          console.debug('[cotizaciones] convertLeadToCliente resp', resp);
          const usuarioAccion = (resp as any)?.usuarioAccion;
          const clienteAccion = (resp as any)?.clienteAccion;
          const acciones = [usuarioAccion, clienteAccion]
            .map(valor => (valor ?? '').toString().trim().toUpperCase())
            .filter(Boolean);
          const conversionExitosa = !acciones.length
            || acciones.every(accion => accion === 'CREADO' || accion === 'ACTUALIZADO');

          if (!conversionExitosa) {
            console.warn('[cotizaciones] convertLeadToCliente con estados inesperados', acciones);
            this.registroClienteLoading = false;
            this.leadConversionPending = false;
            this.registroClienteError = 'La respuesta del backend no confirma la conversión del lead.';
            return;
          }

          console.debug('[cotizaciones] conversión de lead exitosa, continuando con updateEstado', {
            contactoId,
            destino: this.estadoDestino,
            cotizacionId: this.estadoTarget?.id ?? this.leadConversionTarget?.id
          });
          this.clienteCreadoEnAceptacion = true;
          this.registroClienteLoading = false;
          this.leadConversionPending = false;
          this.closeLeadRegistroModal(false);
          this.ejecutarCambioEstado();
        },
        error: (err) => {
          this.registroClienteLoading = false;
          this.clienteCreadoEnAceptacion = false;
          const msg = err?.error?.message ?? 'No pudimos registrar al cliente. Intenta nuevamente.';
          this.registroClienteError = msg;
          console.error('[cotizaciones] convertLeadToCliente error', err);
        }
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

  private esLead(cotizacion: Cotizacion | null): boolean {
    const contacto = cotizacion?.contacto ?? null;
    const origen = (contacto?.origen ?? '').toString().trim().toUpperCase();
    return origen === 'LEAD';
  }

  private mergeCotizacion(base: Cotizacion, actualizada: Cotizacion): Cotizacion {
    const contacto = actualizada.contacto ?? base.contacto;
    const contactoResumen = actualizada.contactoResumen ?? base.contactoResumen;
    return this.withClienteDisplay({
      ...base,
      ...actualizada,
      contacto,
      contactoResumen
    });
  }

  private withClienteDisplay(cotizacion: Cotizacion): Cotizacion {
    const { label, subtitle } = this.buildClienteDisplay(cotizacion);

    return {
      ...cotizacion,
      cliente: label,
      contactoResumen: subtitle || undefined
    };
  }

  private buildClienteDisplay(cotizacion: Cotizacion): { label: string; subtitle?: string } {
    const contacto = cotizacion.contacto ?? {};
    const nombre = this.toOptionalString(contacto.nombre);
    const clienteBase = this.toOptionalString(cotizacion.cliente);
    const contactoResumen = this.toOptionalString(cotizacion.contactoResumen);
    const celular = this.toOptionalString(contacto.celular);

    const etiqueta = nombre
      || clienteBase
      || contactoResumen
      || `Cliente #${contacto.id ?? cotizacion.id}`;

    const subtitulo = contactoResumen
      || celular
      || (nombre && clienteBase && nombre !== clienteBase ? clienteBase : undefined);

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
}

interface RegistroClienteFormModel {
  nombre: string;
  apellido: string;
  correo: string;
  numDoc: string;
  celular: string;
  direccion: string;
}


