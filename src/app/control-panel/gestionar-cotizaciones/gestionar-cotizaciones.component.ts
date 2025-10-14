import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';

import { Cotizacion } from './model/cotizacion.model';
import { CotizacionService } from './service/cotizacion.service';

// TableBase
import { TableColumn } from 'src/app/components/table/table-base.component';

// Util: convertir assets a base64
import { urlToBase64 } from 'src/app/utils/url-to-base64';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-gestionar-cotizaciones',
  templateUrl: './gestionar-cotizaciones.component.html',
  styleUrls: ['./gestionar-cotizaciones.component.css']
})
export class GestionarCotizacionesComponent implements OnInit, OnDestroy {

  columns: TableColumn<Cotizacion>[] = [
    { key: 'codigo',  header: 'Código',  sortable: true,  width: '120px', class: 'text-nowrap' },
    { key: 'cliente', header: 'Cliente', sortable: true },
    { key: 'evento',  header: 'Evento',  sortable: true },
    { key: 'fecha',   header: 'Fecha / horas', sortable: true, width: '160px' },
    { key: 'estado',  header: 'Estado',  sortable: true, width: '120px' },
    { key: 'total',   header: 'Total',   sortable: true, width: '120px', class: 'text-center' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, width: '200px', class: 'text-center' }
  ];

  rows: Cotizacion[] = [];

  loadingList = false;
  downloadingId: number | null = null;
  error: string | null = null;

  estadoModalOpen = false;
  estadoTarget: Cotizacion | null = null;
  estadoDestino: 'Enviada' | 'Aceptada' | 'Rechazada' | '' = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly cotizacionService: CotizacionService,
    private readonly router: Router,
    private readonly http: HttpClient
  ) {}

  ngOnInit(): void { this.loadCotizaciones(); }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  navigateToCreate(): void {
    this.router.navigate(['/home/gestionar-cotizaciones/registrar']);
  }

  ver(_row: Cotizacion) { /* opcional */ }

  editCotizacion(cotizacion: Cotizacion): void {
    if (cotizacion.estado === 'Aceptada' || cotizacion.estado === 'Rechazada') {
      this.error = 'No puedes editar una cotización que ya fue aceptada o rechazada.';
      return;
    }
    this.router.navigate(['/home/gestionar-cotizaciones/editar', cotizacion.id]);
  }

  // === DESCARGAR PDF usando el SERVICE (NO HttpClient directo) ===
  async downloadPdf(cotizacion: Cotizacion): Promise<void> {
    this.error = null;
    this.downloadingId = cotizacion.id;

    try {
      // Assets a base64 (data URL). Ajusta nombres si cambian.
      const logoUrl  = 'assets/images/logocot.jpg';
      const firmaUrl = 'assets/images/firma.png';

      const [logoDataUrl, firmaDataUrl] = await Promise.all([
        urlToBase64(this.http, logoUrl),
        urlToBase64(this.http, firmaUrl),
      ]);

      const payload = {
        company: {
          logoBase64: logoDataUrl,    // data:image/png;base64,...
          firmaBase64: firmaDataUrl,  // data:image/png;base64,...
        },
        videoEquipo: '35 mm y sistema 4K',
      };

      const blob = await firstValueFrom(
        this.cotizacionService.downloadPdf(cotizacion.id, payload)
      );

      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = `${cotizacion.codigo ?? 'cotizacion'}-${cotizacion.id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(fileUrl);
    } catch (err) {
      console.error('[cotizacion] pdf', err);
      this.error = 'No se pudo descargar el PDF. Revisa que /api/v1/cotizaciones/:id/pdf o el alias /api/cotizacion/:id/pdf respondan en el backend.';
    } finally {
      this.downloadingId = null;
    }
  }

  openEstadoModal(cotizacion: Cotizacion, destino: 'Enviada' | 'Aceptada' | 'Rechazada'): void {
    this.error = null;
    if (!cotizacion || !cotizacion.total || cotizacion.total <= 0) {
      this.error = 'La cotización debe tener un total mayor a cero para cambiar de estado.';
      return;
    }
    this.estadoTarget = cotizacion;
    this.estadoDestino = destino;
    this.estadoModalOpen = true;
  }

  closeEstadoModal(): void {
    this.estadoModalOpen = false;
    this.estadoDestino = '';
    this.estadoTarget = null;
  }

  confirmEstadoChange(): void {
    if (!this.estadoTarget || !this.estadoDestino) {
      this.closeEstadoModal(); return;
    }

    const id = this.estadoTarget.id;
    const destino = this.estadoDestino;
    const estadoActual = this.estadoTarget.estado ?? 'Borrador';

    if (!this.estadoTarget.total || this.estadoTarget.total <= 0) {
      this.error = 'La cotización debe tener un total mayor a cero para cambiar de estado.';
      this.closeEstadoModal(); return;
    }

    this.cotizacionService.updateEstado(id, destino, estadoActual)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (actualizada) => {
          this.error = null;
          if (actualizada) {
            this.rows = this.rows.map(item =>
              item.id === actualizada.id ? { ...item, ...actualizada } : item
            );
            this.rows = [...this.rows];
            if (this.estadoTarget && this.estadoTarget.id === actualizada.id) {
              this.estadoTarget = { ...this.estadoTarget, ...actualizada };
            }
          } else {
            this.loadCotizaciones();
          }
          this.closeEstadoModal();
        },
        error: (err) => {
          console.error('[cotizacion] updateEstado', err);
          this.error = 'No pudimos actualizar el estado. Verifica e intenta nuevamente.';
          this.closeEstadoModal();
        }
      });
  }

  get estadoModalTitle(): string { return 'Confirmar cambio de estado'; }

  get estadoModalMessage(): string {
    if (!this.estadoTarget) return '';
    const nombre = this.estadoTarget.codigo ?? `Cotización #${this.estadoTarget.id}`;
    const estadoActual = this.estadoTarget.estado ?? 'Borrador';
    if (estadoActual === 'Borrador') return `Marcar ${nombre} como enviada.`;
    return `Selecciona el nuevo estado para ${nombre}. Estado actual: ${estadoActual}`;
  }

  onSortChange(_evt: { key: string; direction: 'asc' | 'desc' | '' }) {}
  onPageChange(_evt: { page: number; pageSize: number }) {}

  reload(): void { this.loadCotizaciones(); }

  private loadCotizaciones(): void {
    this.loadingList = true;
    this.error = null;

    this.cotizacionService.listCotizaciones()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cotizaciones) => {
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
