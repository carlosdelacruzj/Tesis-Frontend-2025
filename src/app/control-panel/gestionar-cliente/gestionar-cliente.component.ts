import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { from, Subject, takeUntil } from 'rxjs';

import { TableColumn } from 'src/app/components/table-base-mejora/table-base-mejora.component';
import { Cliente } from './model/cliente.model';
import { ClienteService } from './service/cliente.service';

export interface ClienteRow extends Cliente {}

@Component({
  selector: 'app-gestionar-cliente',
  templateUrl: './gestionar-cliente.component.html',
  styleUrls: ['./gestionar-cliente.component.css']
})
export class GestionarClienteComponent implements OnInit, OnDestroy {

  columns: TableColumn<ClienteRow>[] = [
    { key: 'codigoCliente', header: 'ID', sortable: true, width: '100px', class: 'text-center text-nowrap text-uppercase' },
    { key: 'nombre', header: 'Nombre', sortable: true },
    { key: 'apellido', header: 'Apellido', sortable: true },
    { key: 'correo', header: 'Correo', sortable: true },
    { key: 'celular', header: 'Celular', sortable: true, class: 'text-nowrap' },
    { key: 'doc', header: 'Documento', sortable: true, width: '160px', class: 'text-nowrap' },
    { key: 'direccion', header: 'Dirección', sortable: true },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '120px', class: 'text-center text-nowrap' }
  ];

  rows: ClienteRow[] = [];
  loadingList = false;
  error: string | null = null;
  readonly initialSort = { key: 'nombre', direction: 'asc' as const };

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly clienteService: ClienteService,
    private readonly router: Router
  ) { }

  ngOnInit(): void {
    this.loadClientes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToCreate(): void {
    this.router.navigate(['/home/gestionar-cliente/registrar-cliente']);
  }

  editarCliente(row: ClienteRow): void {
    if (!row?.idCliente) {
      return;
    }
    this.clienteService.getByIdCliente(row.idCliente)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.clienteService.selectCliente = Array.isArray(response) ? response[0] ?? row : response;
          this.router.navigate(['/home/gestionar-cliente/editar-cliente']);
        },
        error: (err) => {
          console.error('[clientes] detalle', err);
        }
      });
  }

  onSortChange(_: { key: string; direction: 'asc' | 'desc' | '' }): void {
    // Reservado para telemetría futura
  }

  onPageChange(_: { page: number; pageSize: number }): void {
    // Reservado para telemetría futura
  }

  reload(): void {
    this.loadClientes();
  }

  private loadClientes(): void {
    this.loadingList = true;
    this.error = null;

    from(this.clienteService.getAllClientes())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (clientes) => {
          this.rows = (clientes ?? []) as ClienteRow[];
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[clientes] list', err);
          this.error = 'No pudimos cargar los clientes.';
          this.rows = [];
          this.loadingList = false;
        }
      });
  }
}
