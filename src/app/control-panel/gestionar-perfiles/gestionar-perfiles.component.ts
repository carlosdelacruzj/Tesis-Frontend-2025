import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { from, Subject, takeUntil } from 'rxjs';

import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { Perfil } from './model/perfil.model';
import { PerfilService } from './service/perfil.service';

export interface PerfilRow extends Perfil {
  nombreCompleto: string;
}

@Component({
  selector: 'app-gestionar-perfiles',
  templateUrl: './gestionar-perfiles.component.html',
  styleUrls: ['./gestionar-perfiles.component.css']
})
export class GestionarPerfilesComponent implements OnInit, OnDestroy {

  columns: TableColumn<PerfilRow>[] = [
    { key: 'ID', header: 'ID', sortable: true, width: '90px', class: 'text-center text-nowrap' },
    { key: 'ROL', header: 'Rol', sortable: true },
    { key: 'nombreCompleto', header: 'Nombre', sortable: true },
    { key: 'correo', header: 'Correo', sortable: true },
    { key: 'celular', header: 'Celular', sortable: true, class: 'text-nowrap' },
    { key: 'doc', header: 'Documento', sortable: true, width: '160px', class: 'text-nowrap' },
    { key: 'direccion', header: 'Dirección', sortable: true },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '120px', class: 'text-center text-nowrap' }
  ];

  rows: PerfilRow[] = [];
  searchTerm = '';
  loadingList = false;
  error: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly perfilService: PerfilService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadPerfiles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateToCreate(): void {
    this.router.navigate(['/home/gestionar-perfiles/registrar-perfil']);
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  editarPerfil(row: PerfilRow): void {
    if (!row?.ID) {
      return;
    }
    this.perfilService.getByIdPerfil(row.ID)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.perfilService.selectPerfil = Array.isArray(response) ? response[0] ?? row : response;
          this.router.navigate(['/home/gestionar-perfiles/editar-perfil']);
        },
        error: (err) => {
          console.error('[perfiles] detalle', err);
        }
      });
  }

  onSortChange(_: { key: string; direction: 'asc' | 'desc' | '' }): void {
    // Hook disponible para telemetría futura
  }

  onPageChange(_: { page: number; pageSize: number }): void {
    // Hook disponible para telemetría futura
  }

  reload(): void {
    this.loadPerfiles();
  }

  private loadPerfiles(): void {
    this.loadingList = true;
    this.error = null;

    from(this.perfilService.getAllPerfiles())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (perfiles) => {
          this.rows = (perfiles ?? []).map((perfil: Perfil) => ({
            ...perfil,
            nombreCompleto: `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim()
          }));
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[perfiles] list', err);
          this.error = 'No pudimos cargar los perfiles.';
          this.rows = [];
          this.loadingList = false;
        }
      });
  }
}
