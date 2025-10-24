import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { PedidoService } from './service/pedido.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';

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

@Component({
  selector: 'app-gestionar-pedido',
  templateUrl: './gestionar-pedido.component.html',
  styleUrls: ['./gestionar-pedido.component.css'],
})
export class GestionarPedidoComponent implements OnInit, OnDestroy {
  columns: TableColumn<PedidoRow>[] = [
    { key: 'ID', header: 'ID', sortable: true, width: '90px', class: 'text-center text-nowrap' },
    { key: 'Cliente', header: 'Cliente', sortable: true, class: 'cliente-col text-center' },
    // { key: 'Creado', header: 'Creado', sortable: true, width: '140px' },
    { key: 'ProxFecha', header: 'Próx. fecha', sortable: true, width: '160px' },
    { key: 'ProxHora', header: 'Próx. hora', sortable: true, width: '120px', class: 'text-center' },
    // { key: 'Ubicacion', header: 'Ubicación', sortable: true },
    { key: 'TipoEvento', header: 'Tipo', sortable: true },
    { key: 'TotalLabel', header: 'Total', sortable: true, width: '140px', class: 'text-end text-nowrap' },
    { key: 'Estado', header: 'Estado', sortable: true, width: '140px', class: 'text-center' },
    { key: 'Pago', header: 'Pago', sortable: true, width: '120px', class: 'text-center' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '160px', class: 'text-center' }
  ];

  rows: PedidoRow[] = [];
  loadingList = false;
  error: string | null = null;


  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly pedidoService: PedidoService,
    private readonly router: Router
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
}
