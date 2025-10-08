import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { Cotizacion } from './model/cotizacion.model';
import { CotizacionService } from './service/cotizacion.service';

// Importa la interfaz de columnas desde TableBase
import { TableColumn } from 'src/app/components/table/table-base.component';

@Component({
  selector: 'app-gestionar-cotizaciones',
  templateUrl: './gestionar-cotizaciones.component.html',
  styleUrls: ['./gestionar-cotizaciones.component.css']
})
export class GestionarCotizacionesComponent implements OnInit, OnDestroy {
  // columnas que verá TableBase
  columns: TableColumn<Cotizacion>[] = [
    { key: 'codigo', header: 'Código', sortable: true, width: '120px', class: 'text-nowrap' },
    { key: 'cliente', header: 'Cliente', sortable: true },
    { key: 'evento',  header: 'Evento',  sortable: true },
    { key: 'fecha',   header: 'Fecha / horas', sortable: true, width: '160px' },
    { key: 'estado',  header: 'Estado',  sortable: true, width: '120px' },
    { key: 'total',   header: 'Total',   sortable: true, width: '120px', class: 'text-center' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '140px', class: 'text-center' }
  ];

  rows: Cotizacion[] = [];

  loadingList = false;
  downloadingId: number | null = null;
  error: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly cotizacionService: CotizacionService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadCotizaciones();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Navegación y acciones (igual que antes)
  navigateToCreate(): void {
    this.router.navigate(['/home/gestionar-cotizaciones/registrar']);
  }

  ver(row: Cotizacion) {
    // si quieres abrir detalle al click en fila, o ignóralo
    // this.router.navigate([...])
  }

  editCotizacion(cotizacion: Cotizacion): void {
    this.router.navigate(['/home/gestionar-cotizaciones/editar', cotizacion.id]);
  }

  downloadPdf(cotizacion: Cotizacion): void {
    this.downloadingId = cotizacion.id;
    this.cotizacionService.downloadPdf(cotizacion.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const fileUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = fileUrl;
          link.download = `${cotizacion.codigo ?? 'cotizacion'}-${cotizacion.id}.pdf`;
          link.click();
          window.URL.revokeObjectURL(fileUrl);
          this.downloadingId = null;
        },
        error: (err) => {
          console.error('[cotizacion] pdf', err);
          this.error = 'No se pudo descargar el PDF. Inténtalo nuevamente.';
          this.downloadingId = null;
        }
      });
  }

  // Hooks opcionales del TableBase (por si quieres loguear/usar server-side luego)
  onSortChange(evt: { key: string; direction: 'asc' | 'desc' | '' }) {
    // console.log('sortChange', evt);
  }
  onPageChange(evt: { page: number; pageSize: number }) {
    // console.log('pageChange', evt);
  }

  // Carga de datos (mismo servicio que ya tenías)
  reload(): void {
    this.loadCotizaciones();
  }

  private loadCotizaciones(): void {
    this.loadingList = true;
    this.error = null;

    this.cotizacionService.listCotizaciones()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cotizaciones) => {
          // Puedes normalizar aquí si lo necesitas
          this.rows = cotizaciones ?? [];
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[cotizaciones] list', err);
          this.error = 'No pudimos cargar las cotizaciones.';
          this.loadingList = false;
        }
      });
  }
}
