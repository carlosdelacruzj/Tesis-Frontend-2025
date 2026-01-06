import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { formatIsoDate, parseDateInput } from '../../shared/utils/date-utils';

import { PedidoService } from './service/pedido.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import {
  RegistrarPagoService,
  ResumenPago
} from '../registrar-pago/service/registrar-pago.service';
import { MetodoPago } from '../registrar-pago/model/metodopago.model';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

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
}

interface ModalPagoState {
  open: boolean;
  cargando: boolean;
  guardando: boolean;
  pedido: PedidoRow | null;
  resumen: ResumenPago | null;
  metodos: MetodoPago[];
  monto: string;
  montoError: string | null;
  metodoId: number | null;
  fecha: string;
  fechaMin: string;
  file: File | null;
  error: string | null;
  fileName: string | null;
  faltanteDeposito: number;
  esPrimerPago: boolean;
}

@Component({
  selector: 'app-gestionar-pedido',
  templateUrl: './gestionar-pedido.component.html',
  styleUrls: ['./gestionar-pedido.component.css'],
})
export class GestionarPedidoComponent implements OnInit, OnDestroy {
    columns: TableColumn<PedidoRow>[] = [
    { key: 'ID', header: 'Codigo', sortable: true, width: '120px', class: 'text-center text-nowrap' },
    { key: 'Cliente', header: 'Cliente', sortable: true, width: '180px', class: 'cliente-col text-center' },
    { key: 'TipoEvento', header: 'Evento', sortable: true, width: '180px' },
    { key: 'ProxFecha', header: 'Prox. fecha', sortable: true, width: '180px' },
    { key: 'ProxHora', header: 'Prox. hora', sortable: true, width: '120px', class: 'text-center' },
    { key: 'TotalLabel', header: 'Total', sortable: true, width: '140px', class: 'text-end text-nowrap' },
    { key: 'Pago', header: 'Pago', sortable: true, width: '120px', class: 'text-center' },
    { key: 'Estado', header: 'Estado', sortable: true, width: '140px', class: 'text-center' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '160px', class: 'text-center' }
  ];

  rows: PedidoRow[] = [];
  searchTerm = '';
  loadingList = false;
  error: string | null = null;
  modalPago: ModalPagoState = this.crearEstadoModal();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly pedidoService: PedidoService,
    private readonly router: Router,
    private readonly registrarPagoService: RegistrarPagoService
  ) { }

  ngOnInit(): void {
    this.loadPedidos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToCreate(): void {
    this.router.navigate(['/home/gestionar-pedido/agregar']);
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
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

  onSortChange(_: { key: string; direction: 'asc' | 'desc' | '' }): void {
    // Hook disponible para telemetría futura
  }

  onPageChange(_: { page: number; pageSize: number }): void {
    // Hook disponible para telemetría futura
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
      fechaMin
    };

    forkJoin({
      resumen: this.registrarPagoService.getResumenPedido(id).pipe(
        catchError(() => of<ResumenPago | null>(null))
      ),
      metodos: this.registrarPagoService.getMetodosPago().pipe(
        catchError(() => of<MetodoPago[]>([]))
      )
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ resumen, metodos }) => {
          const resumenValido = resumen ?? { CostoTotal: 0, MontoAbonado: 0, SaldoPendiente: 0 };
          const total = this.parseMonto(resumenValido.CostoTotal);
          const abonado = this.parseMonto(resumenValido.MontoAbonado);
          const saldo = resumenValido.SaldoPendiente != null
            ? this.parseMonto(resumenValido.SaldoPendiente)
            : Math.max(total - abonado, 0);
          const faltanteDeposito = Math.max(total * 0.5 - abonado, 0);
          const esPrimerPago = abonado <= 0;

          this.modalPago = {
            ...this.modalPago,
            cargando: false,
            resumen: { ...resumenValido, SaldoPendiente: saldo },
            metodos,
            faltanteDeposito,
            esPrimerPago
          };
        },
        error: (err) => {
          console.error('[pagos] resumen', err);
          this.modalPago = {
            ...this.modalPago,
            cargando: false,
            error: 'No se pudo cargar la informacion del pedido.'
          };
        }
      });
  }

  onModalPagoClosed(): void {
    this.modalPago.open = false;
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

  onMontoChange(): void {
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

    if (this.modalPago.faltanteDeposito > 0 && monto < this.modalPago.faltanteDeposito) {
      this.modalPago.montoError = `Debes pagar al menos ${this.faltanteDepositoTexto} en el primer pago.`;
      return;
    }

    this.modalPago.montoError = null;
  }

  get puedeRegistrarPago(): boolean {
    if (this.modalPago.cargando || this.modalPago.guardando) {
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
    const saldo = this.obtenerSaldoPendiente();
    if (saldo <= 0) {
      return false;
    }
    if (saldo > 0 && monto > saldo + 0.01) {
      return false;
    }
    if (this.modalPago.faltanteDeposito > 0 && monto < this.modalPago.faltanteDeposito) {
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
        cancelButton: 'btn btn-outline-secondary'
      }
    });

    if (!confirm.isConfirmed) {
      return;
    }

    const esPrimerPago = this.modalPago.esPrimerPago;

    this.modalPago.guardando = true;
    this.modalPago.error = null;
    try {
      await this.registrarPagoService.postPago({
        file: this.modalPago.file ?? undefined,
        monto,
        pedidoId: id,
        metodoPagoId: this.modalPago.metodoId ?? 0,
        fecha: this.modalPago.fecha || undefined
      });

      if (esPrimerPago) {
        const proyectoNombre =
          (this.modalPago.pedido as any)?.Nombre ??
          (this.modalPago.pedido as any)?.NombrePedido ??
          this.modalPago.pedido.Cliente ??
          `Pedido ${this.modalPago.pedido.ID}`;
        try {
          await this.registrarPagoService.crearProyecto({
            proyectoNombre,
            pedidoId: id,
            estadoId: 1
          });
        } catch (err) {
          console.error('[proyecto] crear', err);
          void Swal.fire({
            icon: 'warning',
            title: 'Pago registrado',
            text: 'El proyecto no pudo crearse automaticamente. Intenta crearlo manualmente.',
            confirmButtonText: 'Entendido',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-warning' }
          });
        }
      }

      const saldoRestante = Math.max(saldoPrevio - monto, 0);
      void Swal.fire({
        icon: 'success',
        title: 'Pago registrado',
        text: saldoRestante > 0
          ? `El pago se registro correctamente. Saldo pendiente: ${this.formatearMoneda(saldoRestante)}`
          : 'El pago se registro correctamente.',
        confirmButtonText: 'Aceptar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-success' }
      });


      this.modalPago.open = false;
      this.loadPedidos();
    } catch (error) {
      console.error('[pagos] registrar', error);
      this.modalPago.error = 'No se pudo registrar el pago. Intenta nuevamente.';
      void Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar',
        text: 'Ocurrio un problema al registrar el pago.',
        confirmButtonText: 'Aceptar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-danger' }
      });
    } finally {
      this.modalPago.guardando = false;
    }
  }

  private loadPedidos(): void {
    this.loadingList = true;
    this.error = null;

    this.pedidoService.getAllPedidos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.rows = (rows ?? []).map((raw: any) => {
            const codigo = this.toOptionalString(
              raw?.codigo ??
              raw?.codigoPedido ??
              raw?.codigo_pedido ??
              raw?.Codigo ??
              raw?.CodigoPedido ??
              raw?.cod_pedido
            );
            const id = this.parseNumber(raw?.id ?? raw?.ID ?? raw?.Id ?? raw?.idPedido ?? raw?.pedidoId ?? raw?.id_pedido);
            const { clienteLabel, clienteSub } = this.buildClienteDisplay(raw);
            const totalLabel = this.toOptionalString(
              raw?.TotalLabel ??
              raw?.Total ??
              raw?.total ??
              raw?.Costo_Total ??
              raw?.costo_total ??
              raw?.costoTotal ??
              raw?.total_pedido
            );
            return {
              ...raw,
              id: id ?? undefined,
              ID: codigo ?? (id ?? raw?.ID),
              Cliente: clienteLabel,
              Documento: clienteSub,
              TotalLabel: totalLabel ?? undefined
            } as PedidoRow;
          });
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[pedidos] list', err);
          this.error = 'No pudimos cargar los pedidos.';
          this.rows = [];
          this.loadingList = false;
        }
      });
  }

  private crearEstadoModal(): ModalPagoState {
    return {
      open: false,
      cargando: false,
      guardando: false,
      pedido: null,
      resumen: null,
      metodos: [],
      monto: '',
      montoError: null,
      metodoId: null,
      fecha: '',
      fechaMin: '',
      file: null,
      error: null,
      fileName: null,
      faltanteDeposito: 0,
      esPrimerPago: false
    };
  }

  private buildClienteDisplay(raw: any): { clienteLabel: string; clienteSub: string | undefined } {
    const clienteObj = raw?.cliente ?? {};
    const nombre = this.toOptionalString(
      raw?.Cliente ??
      raw?.cliente ??
      clienteObj?.nombres ??
      clienteObj?.nombre
    );
    const apellido = this.toOptionalString(clienteObj?.apellidos ?? clienteObj?.apellido);
    const razonSocial = this.toOptionalString(clienteObj?.razonSocial ?? clienteObj?.razon_social);
    const doc = this.toOptionalString(
      raw?.Documento ??
      raw?.documento ??
      clienteObj?.documento ??
      clienteObj?.doc ??
      clienteObj?.dni
    );
    const celular = this.toOptionalString(clienteObj?.celular ?? raw?.celular ?? raw?.Celular);

    const nombreCompuesto = [nombre, apellido].filter(Boolean).join(' ').trim();
    const etiqueta = nombreCompuesto || razonSocial || nombre || raw?.Cliente || '--';
    const subtitulo = doc || celular || undefined;

    return {
      clienteLabel: etiqueta,
      clienteSub: subtitulo
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

  private formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
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

  getPagoPill(row: PedidoRow | null | undefined): { label: string; className: string } {
    const label = this.toOptionalString(row?.Pago) || '--';
    const key = label.trim().toLowerCase();
    let className = 'badge bg-secondary';

    if (['pagado', 'completo', 'pagado total'].includes(key)) {
      className = 'badge bg-success';
    } else if (['parcial', 'parcialmente pagado', 'abono'].includes(key)) {
      className = 'badge bg-warning text-dark';
    } else if (['pendiente', 'sin pago', 'no pagado'].includes(key)) {
      className = 'badge bg-danger';
    } else if (['deposito', 'adelanto'].includes(key)) {
      className = 'badge bg-info text-dark';
    }

    return { label, className };
  }

  private extractId(row: PedidoRow | null | undefined): number | null {
    if (!row) return null;
    const id = this.parseNumber((row as any).id ?? row.ID ?? (row as any).idPedido ?? (row as any).pedidoId);
    return id;
  }

  private getFechaMinPago(row: PedidoRow | null | undefined): string {
    const raw = row as any;
    const fechaRaw =
      raw?.fechaCreacion ??
      raw?.fecha_creacion ??
      raw?.FechaCreacion ??
      raw?.Creado ??
      raw?.fecha ??
      raw?.createdAt ??
      raw?.created_at;
    const parsed = parseDateInput(fechaRaw) ?? new Date();
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
}
