import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { Cotizacion } from './model/cotizacion.model';
import { CotizacionService } from './service/cotizacion.service';

@Component({
  selector: 'app-gestionar-cotizaciones',
  templateUrl: './gestionar-cotizaciones.component.html',
  styleUrls: ['./gestionar-cotizaciones.component.css']
})
export class GestionarCotizacionesComponent implements OnInit, AfterViewInit, OnDestroy {
  columnsToDisplay = ['codigo', 'cliente', 'evento', 'fecha', 'estado', 'total', 'acciones'];
  dataSource = new MatTableDataSource<Cotizacion>([]);

  loadingList = false;
  downloadingId: number | null = null;
  error: string | null = null;
  private filterValue = '';

  private readonly destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private readonly cotizacionService: CotizacionService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadCotizaciones();
  }

  ngAfterViewInit(): void {
    this.assignTableHelpers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackById(_index: number, item: Cotizacion): number {
    return item.id;
  }

  filterData(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.filterValue = value.trim().toLowerCase();
    this.dataSource.filter = this.filterValue;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  reload(): void {
    this.loadCotizaciones();
  }

  navigateToCreate(): void {
    this.router.navigate(['/home/gestionar-cotizaciones/registrar']);
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

  private loadCotizaciones(): void {
    this.loadingList = true;
    this.error = null;
    this.cotizacionService.listCotizaciones()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cotizaciones) => {
          this.dataSource = new MatTableDataSource<Cotizacion>(cotizaciones);
          this.assignTableHelpers();
          this.dataSource.filterPredicate = (data, filter) => {
            const raw: any = data.raw ?? {};
            const lead = data.lead ?? (raw?.lead as any);
            const values = [
              data.codigo,
              data.cliente,
              data.contacto,
              data.evento,
              data.estado,
              data.horasEstimadas,
              data.total?.toString(),
              data.fecha,
              data.notas,
              data.lugar,
              data.eventoSolicitado,
              lead?.nombre,
              lead?.celular,
              lead?.origen,
              raw?.descripcion,
              raw?.mensaje
            ]
              .filter(Boolean)
              .map((v) => String(v).toLowerCase());
            return values.some((value) => value.includes(filter));
          };
          if (this.filterValue) {
            this.dataSource.filter = this.filterValue;
          }
          this.loadingList = false;
        },
        error: (err) => {
          console.error('[cotizaciones] list', err);
          this.error = 'No pudimos cargar las cotizaciones.';
          this.loadingList = false;
        }
      });
  }

  private assignTableHelpers(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }
}
