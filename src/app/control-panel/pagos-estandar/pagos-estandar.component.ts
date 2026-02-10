import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { RegistrarPagoService, PedidoLite, ResumenPago, VoucherVM } from '../registrar-pago/service/registrar-pago.service';
import { formatIsoDate, parseDateInput } from '../../shared/utils/date-utils';
import { ComprobantesService } from '../comprobantes/service/comprobantes.service';

type TabKey = 'pendientes' | 'parciales' | 'pagados' | 'cerrados';

interface PagoRow {
  id: number | null;
  codigo: string | number;
  cliente: string;
  fecha?: string;
  fechaCreacion?: string;
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

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'parciales', label: 'Parciales' },
    { key: 'pagados', label: 'Pagados' },
    { key: 'cerrados', label: 'Cerrados' }
  ];

  selectedTab: TabKey = 'pendientes';
  searchTerm = '';
  loading = false;
  error: string | null = null;
  data: Record<TabKey, PagoRow[]> = {
    pendientes: [],
    parciales: [],
    pagados: [],
    cerrados: []
  };
  modal = {
    open: false,
    loading: false,
    guardando: false,
    allowRegistro: true,
    pagadoCompleto: false,
    resumen: null as ResumenPago | null,
    vouchers: [] as VoucherVM[],
    metodos: [] as { idMetodoPago: number; nombre: string }[],
    pedido: null as PagoRow | null,
    error: null as string | null,
    monto: '',
    opcionPago: null as '50' | '100' | null,
    montoError: null as string | null,
    metodoId: null as number | null,
    fecha: '',
    fechaMin: '',
    file: null as File | null,
    fileName: null as string | null,
    faltanteDeposito: 0
  };

  private readonly destroy$ = new Subject<void>();

  private readonly pagoService = inject(RegistrarPagoService);
  private readonly comprobantesService = inject(ComprobantesService);

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
    return ['pagado', 'pagados', 'pagado total', 'completo', 'cerrado', 'cerrados'].includes(key);
  }

  abrirGestionPago(row: PagoRow): void {
    if (!row?.id) return;
    const fechaMin = this.getFechaMinPago(row);
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
      opcionPago: null,
      montoError: null,
      metodoId: null,
      fecha: fechaMin,
      fechaMin,
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
        const resumenValido = res ?? { CostoBase: 0, Igv: 0, CostoTotal: 0, MontoAbonado: 0, SaldoPendiente: 0 };
        const total = this.parseMonto(resumenValido.CostoTotal);
        const abonado = this.parseMonto(resumenValido.MontoAbonado);
        const saldo = resumenValido.SaldoPendiente != null
          ? this.parseMonto(resumenValido.SaldoPendiente)
          : Math.max(total - abonado, 0);
        const faltanteDeposito = Math.max(total * 0.5 - abonado, 0);
        this.modal.resumen = { ...resumenValido, SaldoPendiente: saldo } as ResumenPago;
        this.modal.faltanteDeposito = faltanteDeposito;
        if (saldo <= 0) {
          this.modal.allowRegistro = false;
          this.modal.pagadoCompleto = true;
        }
        this.configurarOpcionPagoInicial();
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
    if (!this.modal.opcionPago) {
      this.modal.montoError = 'Selecciona una opcion de pago.';
      return;
    }
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

  onOpcionPagoChange(opcion: '50' | '100' | null): void {
    this.modal.opcionPago = opcion;
    if (!this.ajustarOpcionPagoSiInvalida()) {
      return;
    }
    if (!opcion) {
      this.modal.monto = '';
      this.modal.montoError = 'Selecciona una opcion de pago.';
      return;
    }
    const monto = this.calcularMontoPorOpcion(opcion);
    this.modal.monto = monto > 0 ? monto.toFixed(2) : '';
    this.onMontoChange();
  }

  onMetodoPagoChange(metodoId: number | null): void {
    this.modal.metodoId = metodoId;
    if (!this.esTransferenciaSeleccionada()) {
      this.modal.file = null;
      this.modal.fileName = null;
    }
  }

  get puedeRegistrar(): boolean {
    if (this.modal.guardando || this.modal.loading) return false;
    if (!this.modal.opcionPago) return false;
    if (this.modal.montoError) return false;
    if (!this.modal.allowRegistro) return false;
    const monto = this.parseMonto(this.modal.monto);
    const saldo = this.obtenerSaldoPendiente();
    if (!monto || monto <= 0) return false;
    if (!this.modal.metodoId) return false;
    if (this.esTransferenciaSeleccionada() && !this.modal.file) return false;
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
    if (this.esTransferenciaSeleccionada() && !this.modal.file) return;
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
      const abonadoPrevio = this.parseMonto(this.modal.resumen?.MontoAbonado ?? 0);
      const esPrimerPago = abonadoPrevio <= 0;

      const response = await this.pagoService.postPago({
        file: this.modal.file ?? undefined,
        monto,
        pedidoId: id,
        metodoPagoId: this.modal.metodoId,
        fecha: this.modal.fecha || undefined
      });

      if (esPrimerPago) {
        try {
          await this.pagoService.crearProyecto({
            pedidoId: id
          });
        } catch (error) {
          console.error('[proyecto] crear', error);
          await Swal.fire({
            icon: 'warning',
            title: 'Pago registrado',
            text: 'El proyecto no pudo crearse automaticamente. Intenta crearlo manualmente.',
            confirmButtonText: 'Entendido',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-warning' }
          });
        }
      }

      await this.refrescarDetalle(id);
      this.loadTab(this.selectedTab, true);

      const saldoRestante = this.obtenerSaldoPendiente();

      // Limpia inputs del modal para el siguiente registro
      this.modal.monto = '';
      this.modal.metodoId = null;
      this.modal.file = null;
      this.modal.fileName = null;
      this.modal.opcionPago = null;
      this.modal.montoError = null;

      void Swal.fire({
        icon: 'success',
        title: 'Pago registrado',
        text: saldoRestante > 0
          ? `Pago registrado correctamente. Saldo pendiente: ${this.formatearMoneda(saldoRestante)}.`
          : 'Pago registrado correctamente. Saldo pendiente: 0.',
        confirmButtonText: 'Aceptar',
        buttonsStyling: false,
        customClass: { confirmButton: 'btn btn-success' }
      });

      this.descargarComprobante(response?.voucherId);
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
            const resumenValido = res ?? { CostoBase: 0, Igv: 0, CostoTotal: 0, MontoAbonado: 0, SaldoPendiente: 0 };
            const total = this.parseMonto(resumenValido.CostoTotal);
            const abonado = this.parseMonto(resumenValido.MontoAbonado);
            const saldo = resumenValido.SaldoPendiente != null
              ? this.parseMonto(resumenValido.SaldoPendiente)
              : Math.max(total - abonado, 0);
            const faltanteDeposito = Math.max(total * 0.5 - abonado, 0);
            this.modal.resumen = { ...resumenValido, SaldoPendiente: saldo } as ResumenPago;
            this.modal.faltanteDeposito = faltanteDeposito;
            this.modal.allowRegistro = saldo > 0;
            this.modal.pagadoCompleto = saldo <= 0;
            this.configurarOpcionPagoInicial();
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

  private calcularMontoPorOpcion(opcion: '50' | '100'): number {
    const resumen = this.modal.resumen;
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
      this.modal.opcionPago = null;
      this.modal.monto = '';
      return;
    }
    const preferida: '50' | '100' = this.modal.faltanteDeposito > 0 ? '50' : '100';
    const montoPreferido = this.calcularMontoPorOpcion(preferida);
    const alternativa: '50' | '100' = preferida === '50' ? '100' : '50';
    const montoAlternativo = this.calcularMontoPorOpcion(alternativa);
    const opcion = montoPreferido > 0 ? preferida : montoAlternativo > 0 ? alternativa : null;
    this.modal.opcionPago = opcion;
    this.modal.monto = opcion ? this.calcularMontoPorOpcion(opcion).toFixed(2) : '';
    this.ajustarOpcionPagoSiInvalida();
    this.onMontoChange();
  }

  private ajustarOpcionPagoSiInvalida(): boolean {
    if (this.modal.opcionPago === '50' && !this.opcionPago50Disponible) {
      if (this.opcionPago100Disponible) {
        this.modal.opcionPago = '100';
        const monto = this.calcularMontoPorOpcion('100');
        this.modal.monto = monto > 0 ? monto.toFixed(2) : '';
        this.onMontoChange();
        return false;
      }
      this.modal.opcionPago = null;
      this.modal.monto = '';
      this.modal.montoError = 'Selecciona una opcion de pago.';
      return false;
    }
    if (this.modal.opcionPago === '100' && !this.opcionPago100Disponible) {
      if (this.opcionPago50Disponible) {
        this.modal.opcionPago = '50';
        const monto = this.calcularMontoPorOpcion('50');
        this.modal.monto = monto > 0 ? monto.toFixed(2) : '';
        this.onMontoChange();
        return false;
      }
      this.modal.opcionPago = null;
      this.modal.monto = '';
      this.modal.montoError = 'Selecciona una opcion de pago.';
      return false;
    }
    return true;
  }

  private redondearMonto(valor: number): number {
    return Math.round(valor * 100) / 100;
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

  esTransferenciaSeleccionada(): boolean {
    const metodoId = this.modal.metodoId;
    if (!metodoId) return false;
    const metodo = this.modal.metodos.find(m => m.idMetodoPago === metodoId);
    const nombre = (metodo?.nombre || '').toLowerCase();
    return nombre.includes('transfer');
  }

  puedeVerVoucher(voucher: VoucherVM | null | undefined): boolean {
    if (!voucher) return false;
    const metodo = (voucher.MetodoPago || '').toString().toLowerCase();
    const link = (voucher.Link || '').toString().trim();
    if (!link) return false;
    return metodo.includes('transfer');
  }

  descargarComprobanteDesdeLista(voucherId: number | string | null | undefined): void {
    const parsed = Number(voucherId);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      void Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'No se encontro el comprobante.',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true
      });
      return;
    }
    this.descargarComprobante(parsed);
  }

  private async descargarComprobante(voucherId: number | undefined | null): Promise<void> {
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
        timerProgressBar: true
      });
      const blob = await firstValueFrom(this.comprobantesService.getVoucherPdf(voucherId));
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
        timerProgressBar: true
      });
    }
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

  get saldoPendienteTexto(): string {
    return this.formatearMoneda(this.obtenerSaldoPendiente());
  }

  get montoSeleccionadoTexto(): string {
    const monto = this.parseMonto(this.modal.monto);
    return monto > 0 ? this.formatearMoneda(monto) : '--';
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
    } else if (tab === 'cerrados') {
      obs = this.pagoService.getPedidosCerrados();
    } else {
      obs = this.pagoService.getPedidosPagados();
    }

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: (resp: PedidoLite[] | null) => {
        const estadoLabel = tab === 'pendientes'
          ? 'Pendiente'
          : tab === 'parciales'
            ? 'Parcial'
            : tab === 'cerrados'
              ? 'Cerrado'
              : 'Pagado';
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
      fechaCreacion: item.FechaCreacion ?? undefined,
      estado
    }));
  }

  private getFechaMinPago(row: PagoRow | null | undefined): string {
    const fechaRaw = row?.fechaCreacion ?? row?.fecha;
    const parsed = parseDateInput(fechaRaw) ?? new Date();
    return formatIsoDate(parsed) ?? new Date().toISOString().slice(0, 10);
  }
}
