import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import {
  ContratoGestionRow,
  ContratoVersionResumen,
} from './model/contrato.model';
import { ContratoService } from './service/contrato.service';

type VigenteFilter = 'all' | 'true' | 'false';

@Component({
  selector: 'app-gestionar-contratos',
  templateUrl: './gestionar-contratos.component.html',
  styleUrls: ['./gestionar-contratos.component.css'],
})
export class GestionarContratosComponent implements OnInit, OnDestroy {
  columns: TableColumn<ContratoGestionRow>[] = [
    { key: 'codigoContrato', header: 'Contrato', sortable: true, width: '140px', class: 'text-center text-nowrap' },
    { key: 'codigoPedido', header: 'Pedido', sortable: true, width: '120px', class: 'text-center text-nowrap' },
    { key: 'cliente', header: 'Cliente', sortable: true, width: '220px' },
    { key: 'fechaContrato', header: 'Fecha creación', sortable: true, width: '130px', class: 'text-center' },
    { key: 'versionContrato', header: 'Version', sortable: true, width: '100px', class: 'text-center' },
    { key: 'estadoContrato', header: 'Estado contrato', sortable: true, width: '150px', class: 'text-center' },
    { key: 'esVigente', header: 'Vigente', sortable: true, width: '100px', class: 'text-center' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '260px', class: 'text-center' },
  ];

  rows: ContratoGestionRow[] = [];
  loadingList = false;
  error: string | null = null;
  searchTerm = '';
  estadosContrato: string[] = [];
  filtroEstado = '';
  filtroVigente: VigenteFilter = 'all';
  downloadingContratoId: number | null = null;

  historialPedidoId: number | null = null;
  historialPedidoCodigo: string | null = null;
  historialLoading = false;
  historialError: string | null = null;
  historialRows: ContratoVersionResumen[] = [];
  vigentePedido: ContratoVersionResumen | null = null;
  vigentePedidoError: string | null = null;
  historialModalOpen = false;

  private readonly contratoService = inject(ContratoService);
  private readonly destroy$ = new Subject<void>();
  private searchDebounceRef: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadContratos();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceRef) {
      clearTimeout(this.searchDebounceRef);
      this.searchDebounceRef = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
    if (this.searchDebounceRef) {
      clearTimeout(this.searchDebounceRef);
    }
    this.searchDebounceRef = setTimeout(() => {
      this.loadContratos();
    }, 280);
  }

  onEstadoFilterChange(value: string): void {
    this.filtroEstado = value ?? '';
    this.loadContratos();
  }

  onVigenteFilterChange(value: VigenteFilter): void {
    this.filtroVigente = value;
    this.loadContratos();
  }

  reload(): void {
    this.loadContratos();
  }

  verPdf(contratoId: number, regenerate = false): void {
    if (!contratoId) {
      return;
    }
    this.downloadingContratoId = contratoId;
    this.contratoService
      .getContratoPdf(contratoId, regenerate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.downloadingContratoId = null;
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
          this.downloadingContratoId = null;
          this.showPdfError(err, 'No se pudo abrir');
        },
      });
  }

  descargarPdf(contratoId: number, regenerate = false): void {
    if (!contratoId) {
      return;
    }
    this.downloadingContratoId = contratoId;
    this.contratoService
      .getContratoPdf(contratoId, regenerate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.downloadingContratoId = null;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `contrato_${contratoId}.pdf`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (err) => {
          this.downloadingContratoId = null;
          this.showPdfError(err, 'No se pudo descargar');
        },
      });
  }

  cargarHistorial(row: ContratoGestionRow): void {
    if (!row?.pedidoId) {
      return;
    }
    this.historialModalOpen = true;
    this.historialPedidoId = row.pedidoId;
    this.historialPedidoCodigo = row.codigoPedido ?? null;
    this.historialLoading = true;
    this.historialError = null;
    this.historialRows = [];
    this.vigentePedido = null;
    this.vigentePedidoError = null;

    this.contratoService
      .getHistorialByPedido(row.pedidoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          this.historialLoading = false;
          this.historialRows = Array.isArray(resp) ? resp : [];
        },
        error: (err) => {
          console.error('[contratos] historial', err);
          this.historialLoading = false;
          this.historialError = 'No pudimos cargar el historial de versiones.';
        },
      });
  }

  closeHistorialModal(): void {
    this.historialModalOpen = false;
    this.historialPedidoId = null;
    this.historialPedidoCodigo = null;
    this.historialLoading = false;
    this.historialError = null;
    this.historialRows = [];
    this.vigentePedido = null;
    this.vigentePedidoError = null;
  }

  cargarVigentePedido(): void {
    if (!this.historialPedidoId) {
      return;
    }
    this.vigentePedido = null;
    this.vigentePedidoError = null;
    this.contratoService
      .getVigenteByPedido(this.historialPedidoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          this.vigentePedido = resp;
        },
        error: (err) => {
          this.vigentePedidoError =
            err?.status === 404
              ? 'Este pedido no tiene contrato vigente.'
              : 'No pudimos cargar el contrato vigente del pedido.';
        },
      });
  }

  private loadContratos(): void {
    this.loadingList = true;
    this.error = null;
    const q = this.searchTerm.trim();
    const vigente =
      this.filtroVigente === 'all'
        ? null
        : this.filtroVigente === 'true';

    this.contratoService
      .getContratos({
        estado: this.filtroEstado || null,
        vigente,
        q: q || null,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          this.loadingList = false;
          this.rows = Array.isArray(resp) ? resp : [];
          this.estadosContrato = Array.from(
            new Set(
              this.rows
                .map((item) => (item.estadoContrato ?? '').trim())
                .filter((item) => item.length > 0),
            ),
          ).sort((a, b) => a.localeCompare(b));
          if (
            this.filtroEstado &&
            !this.estadosContrato.includes(this.filtroEstado)
          ) {
            this.filtroEstado = '';
          }
        },
        error: (err) => {
          console.error('[contratos] list', err);
          this.loadingList = false;
          this.rows = [];
          this.error = 'No pudimos cargar los contratos.';
        },
      });
  }

  private showPdfError(err: unknown, title: string): void {
    const code = (err as { status?: number } | null)?.status;
    const text =
      code === 404
        ? 'El contrato no existe.'
        : code === 422
          ? 'El contrato existe, pero no tiene snapshot para generar el PDF.'
          : 'No pudimos procesar el PDF del contrato.';
    void Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonText: 'Aceptar',
      buttonsStyling: false,
      customClass: { confirmButton: 'btn btn-danger' },
    });
  }
}
