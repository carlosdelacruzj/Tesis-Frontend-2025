import { Component, Inject, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import {
  RegistrarPagoService,
  PedidoLite,
  ResumenPago,
  VoucherVM
} from './service/registrar-pago.service';

import { MetodoPago } from './model/metodopago.model';

@Component({
  selector: 'app-registrar-pago',
  templateUrl: './registrar-pago.component.html',
  styleUrls: ['./registrar-pago.component.css'],
})
export class RegistrarPagoComponent implements OnInit {
  // === Columnas de tablas ===
  displayedColumns: string[] = ['Id', 'Proyecto', 'Fecha', 'Editar'];
  displayedColumns2: string[] = ['Fecha', 'Monto', 'Metodo', 'Imagen'];
  // displayedColumns2: string[] = ['Codigo', 'Fecha', 'Monto', 'Metodo', 'Imagen'];

  // === Estado general ===
  loadingFile = false;
  readonly estado: string = 'Aceptado';

  // === Listas por estado de pago ===
  pedidosParciales: PedidoLite[] = [];
  pedidosPagados: PedidoLite[] = [];
  pedidosPendientes: PedidoLite[] = [];

  // === Detalle ===
  vouchersPago: VoucherVM[] = [];
  metodosPago: MetodoPago[] = [];
  monto = { total: 0, abonado: 0, pendiente: 0 };

  idPedido = 0;
  detallePedido = false;
  listadoPedidos = true;

  // === Form state ===
  selectedFile: File | null = null;
  montoAbonado: number | string = 0;
  metodoPago: number | null = null;

  // === Errores por campo ===
  fileError: string | null = null;
  montoError: string | null = null;
  metodoError: string | null = null;
  excesoError: string | null = null;

  // === Config snackbars ===
  private readonly durationInSeconds = 5;

  // === Reglas de validación ===
  private readonly MAX_FILE_MB = 5;
  // Solo imágenes (si aceptas PDF, añade 'application/pdf' y adapta el visor)
  private readonly ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'] as const;
  private readonly MIN_AMOUNT = 1; // montos enteros y >= 1
  private readonly TRANSFERENCIA_ID = 2; // <--- pon el ID real

  constructor(
    private readonly service: RegistrarPagoService,
    private readonly dialog: MatDialog,
    private readonly sanitizer: DomSanitizer,
    private readonly snackBar: MatSnackBar
  ) { }

  // =========================================
  // Ciclo de vida
  // =========================================
  ngOnInit(): void {
    this.listadoPedidos = true;
    this.detallePedido = false;
    this.getPedidosParciales();
    this.getPedidosPagados();
    this.getPedidosPendientes();
  }
  get isVoucherRequired(): boolean {
    return this.metodoPago === this.TRANSFERENCIA_ID;
  }
  // =========================================
  // Helpers
  // =========================================
  private parseAmount(v: unknown): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number' && isFinite(v)) return v;
    let s = String(v).trim();
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    const n = parseFloat(s.replace(/[^\d-\.]/g, ''));
    return isFinite(n) ? n : 0;
  }
  private isInteger(n: number) { return Number.isInteger(n); }

  // Botón “Registrar” habilitado solo con datos válidos (sin loading)
  get canSubmit(): boolean {
    const monto = this.parseAmount(this.montoAbonado);
    const pendiente = this.parseAmount(this.monto.pendiente);

    const okEntero = this.isInteger(monto);
    const okMin = monto >= this.MIN_AMOUNT;
    const okRange = monto > 0 && monto <= pendiente;
    const okMetodo = this.metodoPago != null;
    const okFile = this.isVoucherRequired ? !!this.selectedFile : true;

    return okEntero && okMin && okRange && okMetodo && okFile;
  }

  // (opcional) bloquear teclas decimales en el input
  blockDecimal(e: KeyboardEvent) {
    const disallowed = ['.', ',', 'e', 'E', '+', '-'];
    if (disallowed.includes(e.key)) e.preventDefault();
  }

  // Mejor rendimiento de tablas
  trackById = (_: number, row: { IdPed?: number; Codigo?: number | string }) =>
    (row as any).IdPed ?? (row as any).Codigo;

  // =========================================
  // Listas
  // =========================================
  getPedidosParciales(): void {
    this.service.getPedidosParciales()
      .pipe(catchError(() => of([])))
      .subscribe(res => { this.pedidosParciales = res || []; });
  }

  getPedidosPagados(): void {
    this.service.getPedidosPagados()
      .pipe(catchError(() => of([])))
      .subscribe(res => { this.pedidosPagados = res || []; });
  }

  getPedidosPendientes(): void {
    this.service.getPedidosPendientes()
      .pipe(catchError(() => of([])))
      .subscribe(res => { this.pedidosPendientes = res || []; });
  }

  // =========================================
  // Detalle
  // =========================================
  private getResumenPedido(id: number): void {
    this.service.getResumenPedido(id)
      .pipe(catchError(() => of<ResumenPago>({ CostoTotal: 0, MontoAbonado: 0 } as ResumenPago)))
      .subscribe((res: ResumenPago) => {
        const abonado = this.parseAmount(res?.MontoAbonado ?? 0);
        const total = this.parseAmount(res?.CostoTotal ?? 0);
        this.monto.abonado = abonado;
        this.monto.total = total;
        this.monto.pendiente = Math.max(0, total - abonado);
      });
  }

  private getMetodosPago(): void {
    this.service.getMetodosPago()
      .pipe(catchError(() => of([])))
      .subscribe(res => { this.metodosPago = res || []; });
  }

  private getVouchers(id: number): void {
    this.service.getVouchersPedido(id)
      .pipe(catchError(() => of([])))
      .subscribe(res => { this.vouchersPago = res || [];
        console.log('Vouchers', res);
        
       });
  }

  // =========================================
  // Navegación
  // =========================================
  getIdPedido(id: number): void {
    this.idPedido = id;
    this.listadoPedidos = false;
    this.detallePedido = true;
    this.getMetodosPago();
    this.getResumenPedido(id);
    this.getVouchers(id);
  }

  mostrarListado(): void {
    this.listadoPedidos = true;
    this.detallePedido = false;
  }

  // =========================================
  // Form (interacciones)
  // =========================================
  onMontoChange(): void {
    // no normalizamos; solo limpiamos errores para que el usuario siga escribiendo
    this.montoError = null;
    this.excesoError = null;
  }

  onMetodoChange(value: number | null): void {
    this.metodoPago = value;
    this.metodoError = null;
    // Si ya no es necesario voucher, limpia selección y error
    if (!this.isVoucherRequired) {
      this.selectedFile = null;
      this.fileError = null;
    }
  }

  onFileSelected(event: Event): void {
    this.fileError = null;

    const input = event?.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    this.selectedFile = file ?? null;

    if (!file) {
      this.fileError = 'Debes seleccionar un archivo.';
      return;
    }

    if (!this.ALLOWED_TYPES.includes(file.type as (typeof this.ALLOWED_TYPES)[number])) {
      this.selectedFile = null;
      this.fileError = 'Tipo no permitido. Usa PNG o JPG.';
      if (input) input.value = '';
      return;
    }

    const maxBytes = this.MAX_FILE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      this.selectedFile = null;
      this.fileError = `Archivo muy grande (máx ${this.MAX_FILE_MB} MB).`;
      if (input) input.value = '';
      return;
    }
  }

  // =========================================
  // Registrar pago (Promise/async-await: postPago devuelve Promise)
  // =========================================
  async uploadFile(): Promise<void> {
    this.fileError = this.montoError = this.metodoError = this.excesoError = null;

    const fecha = new Date().toISOString().slice(0, 10);
    const monto = this.parseAmount(this.montoAbonado);
    const pendiente = this.parseAmount(this.monto.pendiente);

    if (!this.isInteger(monto)) this.montoError = 'El monto debe ser entero (sin decimales).';
    if (monto < this.MIN_AMOUNT) this.montoError = `El monto mínimo es ${this.MIN_AMOUNT}.`;
    if (monto > pendiente) this.excesoError = 'El monto excede el pendiente.';
    if (this.metodoPago == null) this.metodoError = 'Selecciona un método de pago.';
    if (this.isVoucherRequired && !this.selectedFile) this.fileError = 'Debes adjuntar el voucher.';

    if (!this.canSubmit) return;

    this.loadingFile = true;
    try {
      const payload: {
        file?: File;
        monto: number;
        pedidoId: number;
        metodoPagoId: number;
        estadoVoucherId: number;
        fecha: string;
      } = {
        monto,
        pedidoId: this.idPedido,
        metodoPagoId: this.metodoPago!,
        estadoVoucherId: 2,
        fecha
      };

      // ⬇️ Solo adjunta file si realmente se requiere y existe
      if (this.isVoucherRequired && this.selectedFile) {
        payload.file = this.selectedFile;
      }

      await this.service.postPago(payload);

      this.okPago();
      this.getResumenPedido(this.idPedido);
      this.getVouchers(this.idPedido);
      this.getPedidosParciales();
      this.getPedidosPendientes();
      this.getPedidosPagados();

      this.selectedFile = null;
      this.montoAbonado = 0;
      this.metodoPago = null;

    } catch {
      this.errorPago();
    } finally {
      this.loadingFile = false;
    }
  }

  // =========================================
  // Ver imagen (voucher) — abre visor responsive inline
  // =========================================
  openImgById(id: number | string): void {
    const vid = Number(id);
    this.service.getVoucherImageBlob(vid)
      .pipe(
        catchError(() => {
          this.snackBar.open('No se pudo abrir el voucher (¿el archivo existe?)', 'Cerrar', { duration: 3000 });
          return of(null);
        })
      )
      .subscribe(blob => {
        if (!blob) return;

        const objectUrl = URL.createObjectURL(blob);
        const safeUrl: SafeUrl = this.sanitizer.bypassSecurityTrustUrl(objectUrl);

        this.dialog.open(OpenVoucherDialogComponent, {
          data: { img: safeUrl, rawUrl: objectUrl, name: `voucher-${vid}` },
          autoFocus: true,
          restoreFocus: true,
          panelClass: ['image-viewer-dialog-panel', 'mat-elevation-z8'],
          width: '90vw',
          height: '90vh',
          maxWidth: '90vw'
        })
          .afterClosed()
          .subscribe(() => URL.revokeObjectURL(objectUrl));
      });
  }

  onOpenImgClick(ev: Event, codigo: number | string) {
    (ev.currentTarget as HTMLElement)?.blur();
    this.openImgById(codigo);
  }

  // =========================================
  // Snackbars
  // =========================================
  private errorPago(): void {
    this.snackBar.openFromComponent(errorComponent, {
      duration: this.durationInSeconds * 1000,
      panelClass: ['blue-snackbar']
    });
  }

  private okPago(): void {
    this.snackBar.openFromComponent(registroComponent, {
      duration: this.durationInSeconds * 1000,
      panelClass: ['blue-snackbar']
    });
  }
}

// =========================================
// Componentes de mensajes (snackbars)
// =========================================
@Component({
  selector: 'error-pago',
  templateUrl: './messages/error-pago.html',
  styles: [`.example-pizza-party { color: white; text-align: center; }`],
})
export class errorComponent { }

@Component({
  selector: 'pago-registrado',
  templateUrl: './messages/pago-registrado.html',
  styles: [`.example-pizza-party { color: white; text-align: center; }`],
})
export class registroComponent { }

// =========================================
// Visor de imagen responsive (inline)
// =========================================
@Component({
  selector: 'open-voucher-dialog',
  template: `
    <div class="iv-root" cdkTrapFocus>
      <div class="iv-toolbar">
        <div class="iv-spacer"></div>

        <button mat-button (click)="zoomOut()" aria-label="Alejar">–</button>
        <button mat-button (click)="zoomIn()" aria-label="Acercar">+</button>
        <button mat-button (click)="reset()" aria-label="Restablecer">100%</button>
        <button mat-button (click)="toggleFit()" aria-label="Ajustar/1:1">
          {{ fitToScreen ? '1:1' : 'Ajustar' }}
        </button>
        <button mat-button (click)="rotate()" aria-label="Rotar">↻</button>
        <button mat-button (click)="openNewTab()" aria-label="Abrir en nueva pestaña">?</button>

        <button mat-button cdkFocusInitial (click)="close()" aria-label="Cerrar">✕</button>
      </div>

      <div class="iv-body" (wheel)="onWheel($event)" (dblclick)="toggleFit()">
        <img
          [src]="img"
          [alt]="name || 'Voucher'"
          [style.transform]="transform"
          [style.maxWidth.%]="fitToScreen ? 100 : null"
          [style.maxHeight.%]="fitToScreen ? 100 : null"
          [style.width]="fitToScreen ? null : 'auto'"
          [style.height]="fitToScreen ? null : 'auto'"
        />
      </div>
    </div>
  `,
  styles: [`
    .iv-root {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #000;
      padding: 8px; /* o 12px si lo prefieres */
      box-sizing: border-box;
    }
    .iv-toolbar {
      position: sticky;
      top: 8px;
      z-index: 2;
      display: flex;
      gap: .25rem;
      align-items: center;
      height: 44px;
      padding: 0 .5rem;
      background: #111;
      color: #eee;
      border-bottom: 1px solid #2a2a2a;
    }
    .iv-toolbar button[mat-button],
    .iv-toolbar a[mat-button] {
      min-width: 0;
      height: 36px;
      line-height: 36px;
      padding: 0 .5rem;
      font-size: .875rem;
      color: #eee;
      background: #2a2a2a;
      border-radius: 6px;
    }
    .iv-spacer { flex: 1; }
    .iv-body {
      flex: 1;
      overflow: auto;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #000;
    }
    .iv-body img {
      object-fit: contain;
      transform-origin: center;
      user-select: none;
      -webkit-user-drag: none;
      max-width: 100%;
      max-height: 100%;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,.45);
    }
  `]
})
export class OpenVoucherDialogComponent {
  img!: any;        // SafeUrl o string
  rawUrl!: string;  // objectURL crudo
  name?: string;

  fitToScreen = true;
  scale = 1;
  rotation = 0;

  get transform() {
    return `scale(${this.scale}) rotate(${this.rotation}deg)`;
  }

  constructor(
    private readonly ref: MatDialogRef<OpenVoucherDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { img: any; rawUrl: string; name?: string }
  ) {
    this.img = data.img;
    this.rawUrl = data.rawUrl;
    this.name = data.name;
  }

  close() { this.ref.close(); }
  openNewTab() { window.open(this.rawUrl, '_blank', 'noopener'); }

  zoomIn() { this.scale = Math.min(5, this.scale + 0.2); this.fitToScreen = false; }
  zoomOut() { this.scale = Math.max(0.2, this.scale - 0.2); }
  reset() { this.scale = 1; this.rotation = 0; }
  rotate() { this.rotation = (this.rotation + 90) % 360; }

  toggleFit() {
    this.fitToScreen = !this.fitToScreen;
    if (this.fitToScreen) this.scale = 1;
  }

  onWheel(ev: WheelEvent) {
    ev.preventDefault();
    const delta = ev.deltaY > 0 ? -0.1 : 0.1;
    this.scale = Math.min(5, Math.max(0.2, this.scale + delta));
    if (this.scale !== 1) this.fitToScreen = false;
  }
}
