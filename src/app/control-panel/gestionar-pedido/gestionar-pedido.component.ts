import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import {
  DateInput,
  formatIsoDate,
  parseDateInput,
} from '../../shared/utils/date-utils';
import { PedidoService } from './service/pedido.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import {
  RegistrarPagoService,
  ResumenPago,
} from '../registrar-pago/service/registrar-pago.service';
import { MetodoPago } from '../registrar-pago/model/metodopago.model';
import { ComprobantesService } from '../comprobantes/service/comprobantes.service';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { deriveFinancialStatus, FinancialStatusResult } from 'src/app/shared/utils/financial-status.utils';

export interface PedidoRow {
  ID: string | number;
  id?: number; // id numérico para navegación/API
  Cliente: string;
  Documento?: string;
  Creado?: string;
  ProxFecha?: string;
  ProxDia?: string;
  ProxHora?: string;
  Ubicacion?: string;
  TipoEvento?: string;
  TotalLabel?: string;
  Estado?: string;
  Pago?: string;
  contratoVigenteId?: number | null;
  contratoVersionVigente?: number | string | null;
  contratoEstadoVigente?: string | null;
}

interface ModalPagoState {
  open: boolean;
  cargando: boolean;
  guardando: boolean;
  allowRegistro: boolean;
  pagadoCompleto: boolean;
  pedido: PedidoRow | null;
  resumen: ResumenPago | null;
  metodos: MetodoPago[];
  monto: string;
  opcionPago: '50' | '100' | null;
  montoError: string | null;
  metodoId: number | null;
  fecha: string;
  fechaMin: string;
  file: File | null;
  error: string | null;
  fileName: string | null;
  faltanteDeposito: number;
  esPrimerPago: boolean;
  financialStatus: FinancialStatusResult | null;
}

@Component({
  selector: 'app-gestionar-pedido',
  templateUrl: './gestionar-pedido.component.html',
  styleUrls: ['./gestionar-pedido.component.css'],
})
export class GestionarPedidoComponent implements OnInit, OnDestroy {
  columns: TableColumn<PedidoRow>[] = [
    {
      key: 'ID',
      header: 'Codigo',
      sortable: true,
      width: '120px',
      class: 'text-center text-nowrap',
    },
    {
      key: 'Cliente',
      header: 'Cliente',
      sortable: true,
      width: '180px',
      class: 'cliente-col text-center',
    },
    { key: 'TipoEvento', header: 'Evento', sortable: true, width: '180px' },
    { key: 'ProxFecha', header: 'Prox. fecha', sortable: true, width: '180px' },
    {
      key: 'ProxHora',
      header: 'Prox. hora',
      sortable: true,
      width: '120px',
      class: 'text-center',
    },
    {
      key: 'TotalLabel',
      header: 'Total',
      sortable: true,
      width: '140px',
      class: 'text-end text-nowrap',
    },
    {
      key: 'Pago',
      header: 'Pago',
      sortable: true,
      width: '120px',
      class: 'text-center',
    },
    {
      key: 'Estado',
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
      width: '230px',
      class: 'text-center',
    },
  ];

  rows: PedidoRow[] = [];
  searchTerm = '';
  loadingList = false;
  error: string | null = null;
  downloadingId: number | null = null;
  modalPago: ModalPagoState = this.crearEstadoModal();
  showFinancialDetails = false;

  private readonly destroy$ = new Subject<void>();

  private readonly pedidoService = inject(PedidoService);
  private readonly router = inject(Router);
  private readonly registrarPagoService = inject(RegistrarPagoService);
  private readonly comprobantesService = inject(ComprobantesService);

  ngOnInit(): void {
    this.loadPedidos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  verContratoPdf(row: PedidoRow): void {
    const contratoId = this.parseNumber(row?.contratoVigenteId);
    if (!contratoId) {
      return;
    }
    this.downloadingId = contratoId;
    this.pedidoService
      .getContratoPdf(contratoId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          if (this.downloadingId === contratoId) {
            this.downloadingId = null;
          }
        }),
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const opened = window.open(url, '_blank');
          if (!opened) {
            const link = document.createElement('a');
            link.href = url;
            link.download = `contrato_${contratoId}.pdf`;
            link.click();
          }
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (err) => {
          console.error('[pedido] contrato pdf', err);
          const code = err?.status;
          const text =
            code === 404
              ? 'El contrato no existe.'
              : code === 422
                ? 'El contrato existe, pero no tiene snapshot para generar el PDF.'
                : 'No pudimos abrir el contrato PDF.';
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo abrir',
            text,
            confirmButtonText: 'Aceptar',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-danger' },
          });
        },
      });
  }

  verPedido(row: PedidoRow): void {
    const id = this.extractId(row);
    if (!id) {
      return;
    }
    this.router.navigate(['/home/gestionar-pedido/detalle', id]);
  }

  editarPedido(row: PedidoRow): void {
    const id = this.extractId(row);
    if (!id) {
      return;
    }
    this.router.navigate(['/home/gestionar-pedido/actualizar', id]);
  }

  onSortChange(event: { key: string; direction: 'asc' | 'desc' | '' }): void {
    // Hook disponible para telemetría futura
    void event;
  }

  onPageChange(event: { page: number; pageSize: number }): void {
    // Hook disponible para telemetría futura
    void event;
  }

  reload(): void {
    this.loadPedidos();
  }

  abrirModalPago(row: PedidoRow): void {
    const id = this.extractId(row);
    if (!id) {
      return;
    }
    const fechaMin = this.getFechaMinPago(row);
    this.modalPago = {
      ...this.crearEstadoModal(),
      open: true,
      cargando: true,
      pedido: row,
      fecha: fechaMin,
      fechaMin,
    };
    this.showFinancialDetails = false;

    forkJoin({
      resumen: this.registrarPagoService
        .getResumenPedido(id)
        .pipe(catchError(() => of<ResumenPago | null>(null))),
      metodos: this.registrarPagoService
        .getMetodosPago()
        .pipe(catchError(() => of<MetodoPago[]>([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ resumen, metodos }) => {
          const resumenValido = resumen ?? {
            CostoBase: 0,
            Igv: 0,
            CostoTotal: 0,
            MontoAbonado: 0,
            SaldoPendiente: 0,
          };
          const total = this.parseMonto(resumenValido.CostoTotal);
          const abonado = this.parseMonto(resumenValido.MontoAbonado);
          const saldo =
            resumenValido.SaldoPendiente != null
              ? this.parseMonto(resumenValido.SaldoPendiente)
              : Math.max(total - abonado, 0);
          const faltanteDeposito = Math.max(total * 0.5 - abonado, 0);
          const esPrimerPago = abonado <= 0;
          const financialStatus = deriveFinancialStatus({
            estadoLabel: row.Pago,
            montoAbonado: resumenValido.MontoAbonado,
            saldoPendiente: saldo,
            montoPorDevolver: resumenValido.MontoPorDevolver,
            notasCredito: resumenValido.NotasCredito,
          });

          this.modalPago = {
            ...this.modalPago,
            cargando: false,
            resumen: { ...resumenValido, SaldoPendiente: saldo },
            metodos,
            faltanteDeposito,
            esPrimerPago,
            allowRegistro: financialStatus.allowPayment,
            pagadoCompleto: financialStatus.isSettled,
            financialStatus,
          };
          this.configurarOpcionPagoInicial();
        },
        error: (err) => {
          console.error('[pagos] resumen', err);
          this.modalPago = {
            ...this.modalPago,
            cargando: false,
            error: 'No se pudo cargar la informacion del pedido.',
          };
        },
      });
  }

  onModalPagoClosed(): void {
    this.modalPago.open = false;
    this.showFinancialDetails = false;
  }

  toggleFinancialDetails(): void {
    this.showFinancialDetails = !this.showFinancialDetails;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) {
      this.modalPago.file = null;
      this.modalPago.fileName = null;
      return;
    }
    const archivo = input.files[0];
    this.modalPago.file = archivo;
    this.modalPago.fileName = archivo.name;
  }

  limpiarArchivo(): void {
    this.modalPago.file = null;
    this.modalPago.fileName = null;
  }

  onMetodoPagoChange(metodoId: number | null): void {
    this.modalPago.metodoId = metodoId;
    if (!this.esTransferenciaSeleccionada()) {
      this.modalPago.file = null;
      this.modalPago.fileName = null;
    }
  }

  onMontoChange(): void {
    if (!this.modalPago.opcionPago) {
      this.modalPago.montoError = 'Selecciona una opcion de pago.';
      return;
    }
    const monto = this.parseMonto(this.modalPago.monto);
    const saldo = this.obtenerSaldoPendiente();

    if (!monto || monto <= 0) {
      this.modalPago.montoError = 'Ingresa un monto válido.';
      return;
    }

    if (saldo > 0 && monto > saldo + 0.01) {
      this.modalPago.montoError = 'El monto supera el saldo pendiente.';
      return;
    }

    if (
      this.modalPago.faltanteDeposito > 0 &&
      monto < this.modalPago.faltanteDeposito
    ) {
      this.modalPago.montoError = `Debes pagar al menos ${this.faltanteDepositoTexto} en el primer pago.`;
      return;
    }

    this.modalPago.montoError = null;
  }

  onOpcionPagoChange(opcion: '50' | '100' | null): void {
    this.modalPago.opcionPago = opcion;
    if (!this.ajustarOpcionPagoSiInvalida()) {
      return;
    }
    if (!opcion) {
      this.modalPago.monto = '';
      this.modalPago.montoError = 'Selecciona una opcion de pago.';
      return;
    }
    const monto = this.calcularMontoPorOpcion(opcion);
    this.modalPago.monto = monto > 0 ? monto.toFixed(2) : '';
    this.onMontoChange();
  }

  get puedeRegistrarPago(): boolean {
    if (this.modalPago.cargando || this.modalPago.guardando) {
      return false;
    }
    if (!this.modalPago.opcionPago) {
      return false;
    }
    const monto = this.parseMonto(this.modalPago.monto);
    if (!monto || monto <= 0) {
      return false;
    }
    if (this.modalPago.montoError) {
      return false;
    }
    if (!this.modalPago.metodoId) {
      return false;
    }
    if (this.esTransferenciaSeleccionada() && !this.modalPago.file) {
      return false;
    }
    const saldo = this.obtenerSaldoPendiente();
    if (saldo <= 0) {
      return false;
    }
    if (saldo > 0 && monto > saldo + 0.01) {
      return false;
    }
    if (
      this.modalPago.faltanteDeposito > 0 &&
      monto < this.modalPago.faltanteDeposito
    ) {
      return false;
    }
    return true;
  }

  async registrarPago(): Promise<void> {
    const id = this.extractId(this.modalPago.pedido as PedidoRow | null);
    if (!id || !this.puedeRegistrarPago) {
      return;
    }

    // Revalida antes de enviar por si el usuario no modificó el monto después de abrir el modal
    this.onMontoChange();
    if (this.modalPago.montoError) {
      return;
    }
    if (this.esTransferenciaSeleccionada() && !this.modalPago.file) {
      return;
    }

    const monto = this.parseMonto(this.modalPago.monto);
    const saldoPrevio = this.obtenerSaldoPendiente();
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Confirmar pago',
      text: `Registrar pago de ${this.formatearMoneda(monto)}${saldoPrevio ? ` (saldo actual: ${this.formatearMoneda(saldoPrevio)})` : ''}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'btn btn-primary me-2',
        cancelButton: 'btn btn-outline-secondary',
      },
    });

    if (!confirm.isConfirmed) {
      return;
    }

    const esPrimerPago = this.modalPago.esPrimerPago;

    this.modalPago.guardando = true;
    this.modalPago.error = null;
    try {
      const response = await this.registrarPagoService.postPago({
        file: this.modalPago.file ?? undefined,
        monto,
        pedidoId: id,
        metodoPagoId: this.modalPago.metodoId ?? 0,
        fecha: this.modalPago.fecha || undefined,
      });

      if (esPrimerPago) {
        try {
          await this.registrarPagoService.crearProyecto({
            pedidoId: id,
          });
        } catch (err) {
          console.error('[proyecto] crear', err);
          void Swal.fire({
            icon: 'warning',
            title: 'Pago registrado',
            text: 'El proyecto no pudo crearse automaticamente. Intenta crearlo manualmente.',
            confirmButtonText: 'Entendido',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-warning' },
          });
        }
      }

      const saldoRestante = Math.max(saldoPrevio - monto, 0);
      void Swal.fire({
        icon: 'success',
        title: 'Pago registrado',
        text:
          saldoRestante > 0
            ? `Pago registrado correctamente. Saldo pendiente: ${this.formatearMoneda(saldoRestante)}.`
            : 'Pago registrado correctamente. Saldo pendiente: 0.',
        confirmButtonText: 'Aceptar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-success' },
      });

      this.descargarComprobante(response?.voucherId);

      this.modalPago.open = false;
      this.loadPedidos();
    } catch (error) {
      console.error('[pagos] registrar', error);
      this.modalPago.error =
        'No se pudo registrar el pago. Intenta nuevamente.';
      void Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar',
        text: 'Ocurrio un problema al registrar el pago.',
        confirmButtonText: 'Aceptar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-danger' },
      });
    } finally {
      this.modalPago.guardando = false;
    }
  }

  private loadPedidos(): void {
    this.loadingList = true;
    this.error = null;

    this.pedidoService
      .getAllPedidos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          const list = Array.isArray(rows) ? rows : [];
          this.rows = list.map((item) => {
            const raw = this.asRecord(item);
            const codigo = this.toOptionalString(
              raw?.codigo ??
                raw?.codigoPedido ??
                raw?.codigo_pedido ??
                raw?.Codigo ??
                raw?.CodigoPedido ??
                raw?.cod_pedido,
            );
            const id = this.parseNumber(
              raw?.id ??
                raw?.ID ??
                raw?.Id ??
                raw?.idPedido ??
                raw?.pedidoId ??
                raw?.id_pedido,
            );
            const { clienteLabel, clienteSub } = this.buildClienteDisplay(raw);
            const totalLabel = this.toOptionalString(
              raw?.TotalLabel ??
                raw?.Total ??
                raw?.total ??
                raw?.Costo_Total ??
                raw?.costo_total ??
                raw?.costoTotal ??
                raw?.total_pedido,
            );
            return {
              ...raw,
              id: id ?? undefined,
              ID: codigo ?? id ?? raw?.ID,
              Cliente: clienteLabel,
              Documento: clienteSub,
              TotalLabel: totalLabel ?? undefined,
              contratoVigenteId: this.parseNumber(
                raw?.contratoVigenteId ?? raw?.ContratoVigenteId,
              ),
              contratoVersionVigente:
                this.toOptionalString(
                  raw?.contratoVersionVigente ?? raw?.ContratoVersionVigente,
                ) ??
                this.parseNumber(
                  raw?.contratoVersionVigente ?? raw?.ContratoVersionVigente,
                ) ??
                null,
              contratoEstadoVigente:
                this.toOptionalString(
                  raw?.contratoEstadoVigente ?? raw?.ContratoEstadoVigente,
                ) ?? null,
            } as PedidoRow;
          });
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[pedidos] list', err);
          this.error = 'No pudimos cargar los pedidos.';
          this.rows = [];
          this.loadingList = false;
        },
      });
  }

  private crearEstadoModal(): ModalPagoState {
    return {
      open: false,
      cargando: false,
      guardando: false,
      allowRegistro: true,
      pagadoCompleto: false,
      pedido: null,
      resumen: null,
      metodos: [],
      monto: '',
      opcionPago: null,
      montoError: null,
      metodoId: null,
      fecha: '',
      fechaMin: '',
      file: null,
      error: null,
      fileName: null,
      faltanteDeposito: 0,
      esPrimerPago: false,
      financialStatus: null,
    };
  }

  private buildClienteDisplay(raw: Record<string, unknown>): {
    clienteLabel: string;
    clienteSub: string | undefined;
  } {
    const clienteObj = this.asRecord(raw['cliente']);
    const nombre = this.toOptionalString(
      raw['Cliente'] ??
        raw['cliente'] ??
        clienteObj['nombres'] ??
        clienteObj['nombre'],
    );
    const apellido = this.toOptionalString(
      clienteObj['apellidos'] ?? clienteObj['apellido'],
    );
    const razonSocial = this.toOptionalString(
      clienteObj['razonSocial'] ?? clienteObj['razon_social'],
    );
    const doc = this.toOptionalString(
      raw['Documento'] ??
        raw['documento'] ??
        clienteObj['documento'] ??
        clienteObj['doc'] ??
        clienteObj['dni'],
    );
    const celular = this.toOptionalString(
      clienteObj['celular'] ?? raw['celular'] ?? raw['Celular'],
    );

    const nombreCompuesto = [nombre, apellido].filter(Boolean).join(' ').trim();
    const etiqueta =
      nombreCompuesto ||
      razonSocial ||
      nombre ||
      this.toOptionalString(raw['Cliente']) ||
      '--';
    const subtitulo = doc || celular || undefined;

    return {
      clienteLabel: etiqueta,
      clienteSub: subtitulo,
    };
  }

  private parseMonto(valor: unknown): number {
    if (valor === null || valor === undefined) {
      return 0;
    }
    if (typeof valor === 'number') {
      return Number.isFinite(valor) ? valor : 0;
    }
    const texto = String(valor)
      .replace(/\s+/g, '')
      .replace(/[^0-9,.-]/g, '')
      .replace(',', '.');
    const numero = Number.parseFloat(texto);
    return Number.isFinite(numero) ? numero : 0;
  }

  private obtenerSaldoPendiente(): number {
    const resumen = this.modalPago.resumen;
    if (!resumen) {
      return 0;
    }
    return Math.max(this.parseMonto(resumen.SaldoPendiente), 0);
  }

  private calcularMontoPorOpcion(opcion: '50' | '100'): number {
    const resumen = this.modalPago.resumen;
    if (!resumen) return 0;
    const total = this.parseMonto(resumen.CostoTotal);
    const abonado = this.parseMonto(resumen.MontoAbonado);
    const saldo = this.obtenerSaldoPendiente();
    if (opcion === '50') {
      const objetivo = total * 0.5;
      return this.redondearMonto(Math.max(objetivo - abonado, 0));
    }
    return this.redondearMonto(Math.max(saldo, 0));
  }

  private configurarOpcionPagoInicial(): void {
    const saldo = this.obtenerSaldoPendiente();
    if (saldo <= 0) {
      this.modalPago.opcionPago = null;
      this.modalPago.monto = '';
      return;
    }
    const preferida: '50' | '100' =
      this.modalPago.faltanteDeposito > 0 ? '50' : '100';
    const montoPreferido = this.calcularMontoPorOpcion(preferida);
    const alternativa: '50' | '100' = preferida === '50' ? '100' : '50';
    const montoAlternativo = this.calcularMontoPorOpcion(alternativa);

    const opcion =
      montoPreferido > 0
        ? preferida
        : montoAlternativo > 0
          ? alternativa
          : null;
    this.modalPago.opcionPago = opcion;
    this.modalPago.monto = opcion
      ? this.calcularMontoPorOpcion(opcion).toFixed(2)
      : '';
    this.ajustarOpcionPagoSiInvalida();
    this.onMontoChange();
  }

  private ajustarOpcionPagoSiInvalida(): boolean {
    if (this.modalPago.opcionPago === '50' && !this.opcionPago50Disponible) {
      if (this.opcionPago100Disponible) {
        this.modalPago.opcionPago = '100';
        const monto = this.calcularMontoPorOpcion('100');
        this.modalPago.monto = monto > 0 ? monto.toFixed(2) : '';
        this.onMontoChange();
        return false;
      }
      this.modalPago.opcionPago = null;
      this.modalPago.monto = '';
      this.modalPago.montoError = 'Selecciona una opcion de pago.';
      return false;
    }
    if (this.modalPago.opcionPago === '100' && !this.opcionPago100Disponible) {
      if (this.opcionPago50Disponible) {
        this.modalPago.opcionPago = '50';
        const monto = this.calcularMontoPorOpcion('50');
        this.modalPago.monto = monto > 0 ? monto.toFixed(2) : '';
        this.onMontoChange();
        return false;
      }
      this.modalPago.opcionPago = null;
      this.modalPago.monto = '';
      this.modalPago.montoError = 'Selecciona una opcion de pago.';
      return false;
    }
    return true;
  }

  private redondearMonto(valor: number): number {
    return Math.round(valor * 100) / 100;
  }

  private async descargarComprobante(
    voucherId: number | undefined | null,
  ): Promise<void> {
    if (!voucherId) {
      return;
    }
    try {
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'Descargando comprobante...',
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true,
      });
      const blob = await firstValueFrom(
        this.comprobantesService.getVoucherPdf(voucherId),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `comprobante_${voucherId}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('[comprobantes] descargar', error);
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'No se pudo descargar el comprobante.',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
    }
  }

  private formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor);
  }

  esTransferenciaSeleccionada(): boolean {
    const metodoId = this.modalPago.metodoId;
    if (!metodoId) return false;
    const metodo = this.modalPago.metodos.find(
      (m) => m.idMetodoPago === metodoId,
    );
    const nombre = (metodo?.nombre || '').toLowerCase();
    return nombre.includes('transfer');
  }

  get saldoPendienteActual(): number {
    return this.obtenerSaldoPendiente();
  }

  get saldoPendienteTexto(): string {
    return this.formatearMoneda(this.saldoPendienteActual);
  }

  get faltanteDepositoTexto(): string {
    return this.formatearMoneda(this.modalPago.faltanteDeposito);
  }

  get opcionPago50Disponible(): boolean {
    const monto = this.calcularMontoPorOpcion('50');
    return monto > 0 && monto <= this.obtenerSaldoPendiente() + 0.01;
  }

  get opcionPago100Disponible(): boolean {
    const monto = this.calcularMontoPorOpcion('100');
    return monto > 0;
  }

  get opcionPago50Texto(): string {
    return this.formatearMoneda(this.calcularMontoPorOpcion('50'));
  }

  get opcionPago100Texto(): string {
    return this.formatearMoneda(this.calcularMontoPorOpcion('100'));
  }

  get montoSeleccionadoTexto(): string {
    const monto = this.parseMonto(this.modalPago.monto);
    return monto > 0 ? this.formatearMoneda(monto) : '--';
  }

  get modalSettlementTitle(): string {
    if (this.modalPago.financialStatus?.code === 'CERRADO') {
      return 'Caso financiero finalizado';
    }
    return 'Se completo el cobro';
  }

  get modalSettlementSubtitle(): string {
    if (this.modalPago.financialStatus?.code === 'CERRADO' && this.modalPago.financialStatus.closedByCreditNote) {
      return 'Operacion cerrada con nota de credito/devolucion.';
    }
    if (this.modalPago.financialStatus?.code === 'CERRADO') {
      return 'Caso financiero finalizado por cierre administrativo.';
    }
    return 'Sin saldo pendiente.';
  }

  get showAdjustedFinancialSummary(): boolean {
    const r = this.modalPago.resumen;
    if (!r) return false;
    return (
      r.CostoTotalOriginal != null ||
      r.CostoTotalNeto != null ||
      r.CobrosPositivos != null ||
      r.NotasCredito != null ||
      r.MontoPorDevolver != null
    );
  }

  get hasMontoPorDevolver(): boolean {
    return this.parseMonto(this.modalPago.resumen?.MontoPorDevolver ?? 0) > 0;
  }

  get hasSaldoNoCobrable(): boolean {
    return this.parseMonto(this.modalPago.resumen?.SaldoNoCobrable ?? 0) > 0;
  }

  getPagoEstadoLabel(row: PedidoRow | null | undefined): string {
    return this.getFinancialStatusFromRow(row).label;
  }

  isPagoEstadoCerrado(row: PedidoRow | null | undefined): boolean {
    return this.getFinancialStatusFromRow(row).code === 'CERRADO';
  }

  getPagoEstadoTooltip(row: PedidoRow | null | undefined): string {
    const status = this.getFinancialStatusFromRow(row);
    if (status.code !== 'CERRADO') {
      return '';
    }
    return 'Caso financiero finalizado: incluye nota de credito, devolucion o cierre administrativo.';
  }

  puedeAbrirPago(row: PedidoRow | null | undefined): boolean {
    if (!row) return false;
    const status = this.getFinancialStatusFromRow(row);
    return status.allowPayment;
  }

  motivoBloqueoPago(row: PedidoRow | null | undefined): string {
    if (!row) {
      return 'No disponible';
    }
    const status = this.getFinancialStatusFromRow(row);
    if (status.code === 'CERRADO') {
      return 'Caso financiero cerrado: no admite nuevos cobros';
    }
    if (status.code === 'PAGADO') {
      return 'Pagado: sin saldo pendiente';
    }
    return 'No disponible';
  }

  tienePago(row: PedidoRow | null | undefined): boolean {
    if (!row) return false;
    const record = this.asRecord(row);
    const label = this.toOptionalString(
      record['Pago'] ??
        record['pago'] ??
        record['EstadoPago'] ??
        record['estadoPago'] ??
        record['estado_pago'],
    );
    if (!label) return false;
    const key = label.trim().toLowerCase();
    if (['pendiente', 'sin pago', 'no pagado', 'sin pagos'].includes(key)) {
      return false;
    }
    return true;
  }

  pagoCompletado(row: PedidoRow | null | undefined): boolean {
    if (!row) return false;
    return this.getFinancialStatusFromRow(row).isSettled;
  }

  private extractId(row: PedidoRow | null | undefined): number | null {
    if (!row) return null;
    const record = this.asRecord(row);
    const id = this.parseNumber(
      record['id'] ?? row.ID ?? record['idPedido'] ?? record['pedidoId'],
    );
    return id;
  }

  private getFechaMinPago(row: PedidoRow | null | undefined): string {
    const raw = this.asRecord(row);
    const fechaRaw =
      raw['fechaCreacion'] ??
      raw['fecha_creacion'] ??
      raw['FechaCreacion'] ??
      raw['Creado'] ??
      raw['fecha'] ??
      raw['createdAt'] ??
      raw['created_at'];
    const parsed = parseDateInput(this.toDateInput(fechaRaw)) ?? new Date();
    return formatIsoDate(parsed) ?? new Date().toISOString().slice(0, 10);
  }

  private parseNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const parsed = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  }

  private toDateInput(value: unknown): DateInput {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return null;
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (typeof value === 'string') {
      const t = value.trim();
      return t || undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }

  private getFinancialStatusFromRow(
    row: PedidoRow | null | undefined,
  ): FinancialStatusResult {
    const record = this.asRecord(row);
    const label = this.toOptionalString(
      record['Pago'] ??
        record['pago'] ??
        record['EstadoPago'] ??
        record['estadoPago'] ??
        record['estado_pago'],
    );
    return deriveFinancialStatus({ estadoLabel: label });
  }
}
