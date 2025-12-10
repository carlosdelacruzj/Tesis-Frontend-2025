import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PedidoService } from './service/pedido.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import {
  RegistrarPagoService,
  ResumenPago
} from '../registrar-pago/service/registrar-pago.service';
import { MetodoPago } from '../registrar-pago/model/metodopago.model';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

export interface PedidoRow {
  ID: number;
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
  metodoId: number | null;
  fecha: string;
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
    { key: 'ID', header: 'Código', sortable: true, width: '120px', class: 'text-center text-nowrap' },
    { key: 'Cliente', header: 'Cliente', sortable: true, class: 'cliente-col text-center' },
    // { key: 'Creado', header: 'Creado', sortable: true, width: '140px' },
    { key: 'ProxFecha', header: 'Próx. fecha', sortable: true, width: '160px' },
    { key: 'ProxHora', header: 'Próx. hora', sortable: true, width: '120px', class: 'text-center' },
    // { key: 'Ubicacion', header: 'Ubicación', sortable: true },
    { key: 'TipoEvento', header: 'Tipo', sortable: true },
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
    if (!row?.ID) {
      return;
    }
    this.router.navigate(['/home/gestionar-pedido/detalle', row.ID]);
  }

  editarPedido(row: PedidoRow): void {
    if (!row?.ID) {
      return;
    }
    this.router.navigate(['/home/gestionar-pedido/actualizar', row.ID]);
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
    if (!row?.ID) {
      return;
    }
    this.modalPago = {
      ...this.crearEstadoModal(),
      open: true,
      cargando: true,
      pedido: row,
      fecha: new Date().toISOString().split('T')[0]
    };

    forkJoin({
      resumen: this.registrarPagoService.getResumenPedido(row.ID).pipe(
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
            error: 'No se pudo cargar la información del pedido.'
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

  get puedeRegistrarPago(): boolean {
    if (this.modalPago.cargando || this.modalPago.guardando) {
      return false;
    }
    const monto = this.parseMonto(this.modalPago.monto);
    if (!monto || monto <= 0) {
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
    if (!this.modalPago.pedido?.ID || !this.puedeRegistrarPago) {
      return;
    }

    const monto = this.parseMonto(this.modalPago.monto);
    const saldoPrevio = this.obtenerSaldoPendiente();
    const esPrimerPago = this.modalPago.esPrimerPago;

    this.modalPago.guardando = true;
    this.modalPago.error = null;
    try {
      await this.registrarPagoService.postPago({
        file: this.modalPago.file ?? undefined,
        monto,
        pedidoId: this.modalPago.pedido.ID,
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
            pedidoId: this.modalPago.pedido.ID,
            estadoId: 1
          });
        } catch (err) {
          console.error('[proyecto] crear', err);
          void Swal.fire({
            icon: 'warning',
            title: 'Pago registrado',
            text: 'El proyecto no pudo crearse automáticamente. Intenta crearlo manualmente.',
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
          ? `El pago se registró correctamente. Saldo pendiente: ${this.formatearMoneda(saldoRestante)}`
          : 'El pago se registró correctamente.',
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
        text: 'Ocurrió un problema al registrar el pago.',
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
          this.rows = (rows ?? []) as PedidoRow[];
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
      metodoId: null,
      fecha: '',
      file: null,
      error: null,
      fileName: null,
      faltanteDeposito: 0,
      esPrimerPago: false
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
}
