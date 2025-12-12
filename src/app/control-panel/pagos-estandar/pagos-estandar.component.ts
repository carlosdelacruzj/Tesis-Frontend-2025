import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { RegistrarPagoService, PedidoLite, ResumenPago, VoucherVM } from '../registrar-pago/service/registrar-pago.service';

type TabKey = 'pendientes' | 'parciales' | 'pagados';

interface PagoRow {
  id: number | null;
  codigo: string | number;
  cliente: string;
  fecha?: string;
  estado: string;
}

@Component({
  selector: 'app-pagos-estandar',
  templateUrl: './pagos-estandar.component.html',
  styleUrls: ['./pagos-estandar.component.css']
})
export class PagosEstandarComponent implements OnInit, OnDestroy {
  columns: TableColumn<PagoRow>[] = [
    { key: 'codigo', header: 'Código', sortable: true, width: '140px', class: 'text-center text-nowrap' },
    { key: 'cliente', header: 'Cliente', sortable: true, width: '240px' },
    { key: 'fecha', header: 'Fecha', sortable: true, width: '160px', class: 'text-center text-nowrap' },
    { key: 'estado', header: 'Estado', sortable: true, width: '140px', class: 'text-center' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '140px', class: 'text-center' }
  ];

  readonly tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'parciales', label: 'Parciales' },
    { key: 'pagados', label: 'Pagados' }
  ];

  selectedTab: TabKey = 'pendientes';
  searchTerm = '';
  loading = false;
  error: string | null = null;
  data: Record<TabKey, PagoRow[]> = {
    pendientes: [],
    parciales: [],
    pagados: []
  };
  modal = {
    open: false,
    loading: false,
    guardando: false,
    allowRegistro: true,
    pagadoCompleto: false,
    resumen: null as ResumenPago | null,
    vouchers: [] as VoucherVM[],
    metodos: [] as Array<{ idMetodoPago: number; nombre: string }>,
    pedido: null as PagoRow | null,
    error: null as string | null,
    monto: '',
    montoError: null as string | null,
    metodoId: null as number | null,
    fecha: '',
    file: null as File | null,
    fileName: null as string | null,
    faltanteDeposito: 0
  };

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly pagoService: RegistrarPagoService) { }

  ngOnInit(): void {
    this.loadTab(this.selectedTab);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  onTabChange(tab: TabKey): void {
    this.selectedTab = tab;
    if (!(this.data[tab]?.length)) {
      this.loadTab(tab);
    }
  }

  onRefresh(): void {
    this.loadTab(this.selectedTab, true);
  }

  get visibleRows(): PagoRow[] {
    const term = (this.searchTerm || '').toLowerCase().trim();
    const rows = this.data[this.selectedTab] ?? [];
    if (!term) {
      return rows;
    }
    return rows.filter(r =>
      (r.codigo?.toString().toLowerCase().includes(term)) ||
      (r.cliente?.toLowerCase().includes(term)) ||
      (r.estado?.toLowerCase().includes(term))
    );
  }

  isPagado(row: PagoRow | null | undefined): boolean {
    const key = (row?.estado || '').toLowerCase();
    return ['pagado', 'pagados', 'pagado total', 'completo'].includes(key);
  }

  abrirGestionPago(row: PagoRow): void {
    if (!row?.id) return;
    const today = new Date().toISOString().split('T')[0];
    this.modal = {
      ...this.modal,
      open: true,
      loading: true,
      guardando: false,
      resumen: null,
      vouchers: [],
      metodos: [],
      pedido: row,
      error: null,
      monto: '',
      montoError: null,
      metodoId: null,
      fecha: today,
      file: null,
      fileName: null,
      faltanteDeposito: 0,
      allowRegistro: !this.isPagado(row),
      pagadoCompleto: this.isPagado(row)
    };

    this.pagoService.getMetodosPago().pipe(takeUntil(this.destroy$)).subscribe({
      next: (m) => { this.modal.metodos = m ?? []; },
      error: () => { this.modal.metodos = []; }
    });

    this.pagoService.getResumenPedido(row.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const total = this.parseMonto(res?.CostoTotal ?? 0);
        const abonado = this.parseMonto(res?.MontoAbonado ?? 0);
        const saldo = res?.SaldoPendiente != null
          ? this.parseMonto(res.SaldoPendiente)
          : Math.max(total - abonado, 0);
        const faltanteDeposito = Math.max(total * 0.5 - abonado, 0);
        this.modal.resumen = { ...res, SaldoPendiente: saldo } as ResumenPago;
        this.modal.faltanteDeposito = faltanteDeposito;
        if (saldo <= 0) {
          this.modal.allowRegistro = false;
          this.modal.pagadoCompleto = true;
        }
        this.modal.loading = false;
      },
      error: () => {
        this.modal.error = 'No se pudo cargar el resumen del pedido.';
        this.modal.loading = false;
      }
    });

    this.pagoService.getVouchersPedido(row.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (v) => { this.modal.vouchers = v ?? []; },
      error: () => { this.modal.error = 'No se pudieron cargar los vouchers.'; }
    });
  }

  cerrarGestionPago(): void {
    this.modal.open = false;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) {
      this.modal.file = null;
      this.modal.fileName = null;
      return;
    }
    const archivo = input.files[0];
    this.modal.file = archivo;
    this.modal.fileName = archivo.name;
  }

  limpiarArchivo(): void {
    this.modal.file = null;
    this.modal.fileName = null;
  }

  onMontoChange(): void {
    const monto = this.parseMonto(this.modal.monto);
    const saldo = this.obtenerSaldoPendiente();

    if (!monto || monto <= 0) {
      this.modal.montoError = 'Ingresa un monto válido.';
      return;
    }
    if (saldo > 0 && monto > saldo + 0.01) {
      this.modal.montoError = 'El monto supera el saldo pendiente.';
      return;
    }
    if (this.modal.faltanteDeposito > 0 && monto < this.modal.faltanteDeposito) {
      this.modal.montoError = `Debes pagar al menos ${this.formatearMoneda(this.modal.faltanteDeposito)} en el primer pago.`;
      return;
    }
    this.modal.montoError = null;
  }

  get puedeRegistrar(): boolean {
    if (this.modal.guardando || this.modal.loading) return false;
    if (this.modal.montoError) return false;
    if (!this.modal.allowRegistro) return false;
    const monto = this.parseMonto(this.modal.monto);
    const saldo = this.obtenerSaldoPendiente();
    if (!monto || monto <= 0) return false;
    if (!this.modal.metodoId) return false;
    if (saldo <= 0) return false;
    if (monto > saldo + 0.01) return false;
    if (this.modal.faltanteDeposito > 0 && monto < this.modal.faltanteDeposito) return false;
    return true;
  }

  async registrarPago(): Promise<void> {
    const id = this.modal.pedido?.id;
    if (!id) return;
    this.onMontoChange();
    if (this.modal.montoError) return;

    const monto = this.parseMonto(this.modal.monto);
    const saldo = this.obtenerSaldoPendiente();
    if (!monto || monto <= 0 || !this.modal.metodoId) return;
    if (saldo <= 0 || monto > saldo + 0.01) {
      this.modal.montoError = 'El monto supera el saldo pendiente.';
      return;
    }

    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Confirmar pago',
      text: `Registrar pago de ${this.formatearMoneda(monto)}${saldo ? ` (saldo actual: ${this.formatearMoneda(saldo)})` : ''}?`,
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

    this.modal.guardando = true;
    this.modal.error = null;
    try {
      await this.pagoService.postPago({
        file: this.modal.file ?? undefined,
        monto,
        pedidoId: id,
        metodoPagoId: this.modal.metodoId,
        fecha: this.modal.fecha || undefined
      });

      await this.refrescarDetalle(id);
      this.loadTab(this.selectedTab, true);

      const saldoRestante = this.obtenerSaldoPendiente();
      const texto = saldoRestante > 0
        ? 'El pago se registró correctamente.'
        : 'Pago completado. El saldo llegó a 0.';

      // Limpia inputs del modal para el siguiente registro
      this.modal.monto = '';
      this.modal.metodoId = null;
      this.modal.file = null;
      this.modal.fileName = null;
      this.modal.montoError = null;

      await Swal.fire({
        icon: 'success',
        title: 'Pago registrado',
        text: texto,
        confirmButtonText: 'Aceptar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-success' }
      });
    } catch (error) {
      console.error('[pagos-estandar] registrar', error);
      this.modal.error = 'No se pudo registrar el pago. Intenta nuevamente.';
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar',
        text: 'Ocurrió un problema al registrar el pago.',
        confirmButtonText: 'Aceptar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-danger' }
      });
    } finally {
      this.modal.guardando = false;
    }
  }

  irAPagados(): void {
    this.selectedTab = 'pagados';
    this.loadTab('pagados', true);
    this.cerrarGestionPago();
  }

  private async refrescarDetalle(pedidoId: number): Promise<void> {
    await Promise.all([
      new Promise<void>((resolve) => {
        this.pagoService.getResumenPedido(pedidoId).pipe(takeUntil(this.destroy$)).subscribe({
          next: (res) => {
            const total = this.parseMonto(res?.CostoTotal ?? 0);
            const abonado = this.parseMonto(res?.MontoAbonado ?? 0);
            const saldo = res?.SaldoPendiente != null
              ? this.parseMonto(res.SaldoPendiente)
              : Math.max(total - abonado, 0);
            const faltanteDeposito = Math.max(total * 0.5 - abonado, 0);
            this.modal.resumen = { ...res, SaldoPendiente: saldo } as ResumenPago;
            this.modal.faltanteDeposito = faltanteDeposito;
            this.modal.allowRegistro = saldo > 0;
            this.modal.pagadoCompleto = saldo <= 0;
            resolve();
          },
          error: () => {
            this.modal.error = 'No se pudo refrescar el resumen.';
            resolve();
          }
        });
      }),
      new Promise<void>((resolve) => {
        this.pagoService.getVouchersPedido(pedidoId).pipe(takeUntil(this.destroy$)).subscribe({
          next: (v) => { this.modal.vouchers = v ?? []; resolve(); },
          error: () => { this.modal.error = 'No se pudieron refrescar los vouchers.'; resolve(); }
        });
      })
    ]);
  }

  private obtenerSaldoPendiente(): number {
    if (!this.modal.resumen) return 0;
    return Math.max(this.parseMonto(this.modal.resumen.SaldoPendiente), 0);
  }

  private parseMonto(valor: unknown): number {
    if (valor === null || valor === undefined) return 0;
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
    const texto = String(valor).replace(/\s+/g, '').replace(/[^0-9,.-]/g, '').replace(',', '.');
    const numero = Number.parseFloat(texto);
    return Number.isFinite(numero) ? numero : 0;
  }

  private formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor);
  }

  private loadTab(tab: TabKey, force = false): void {
    if (!force && this.loading) {
      return;
    }
    this.loading = true;
    this.error = null;

    let obs;
    if (tab === 'pendientes') {
      obs = this.pagoService.getPedidosPendientes();
    } else if (tab === 'parciales') {
      obs = this.pagoService.getPedidosParciales();
    } else {
      obs = this.pagoService.getPedidosPagados();
    }

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: (resp: PedidoLite[] | null) => {
        const estadoLabel = tab === 'pendientes' ? 'Pendiente' : tab === 'parciales' ? 'Parcial' : 'Pagado';
        this.data[tab] = this.mapPedidos(resp ?? [], estadoLabel);
        this.loading = false;
      },
      error: (err) => {
        console.error('[pagos-estandar] load', err);
        this.error = 'No se pudo cargar la lista de pagos.';
        this.loading = false;
      }
    });
  }

  private mapPedidos(list: PedidoLite[], estado: string): PagoRow[] {
    return (list || []).map(item => ({
      id: item.IdPed ?? null,
      codigo: item.IdPed ?? item.Nombre ?? '--',
      cliente: item.Nombre ?? '--',
      fecha: item.Fecha ?? '',
      estado
    }));
  }
}
