import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AddEventoComponent } from 'src/app/components/add-evento/add-evento.component';
import { Evento } from './model/evento-servicio.model';
import { EventoServicioDataService } from './service/evento-servicio-data.service';

@Component({
  selector: 'app-administrar-paquete-servicio',
  templateUrl: './administrar-paquete-servicio.component.html',
  styleUrls: ['./administrar-paquete-servicio.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdministrarPaqueteServicioComponent implements OnInit {
  eventos: Evento[] = [];
  eventosFiltrados: Evento[] = [];
  loadingEventos = false;
  searchTerm = '';

  constructor(
    private readonly dataService: EventoServicioDataService,
    private readonly cdr: ChangeDetectorRef,
    private readonly dialog: MatDialog,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.cargarEventos();
  }

  seleccionarEventoPorId(id: number): void {
    this.router.navigate(['/home/administrar-paquete-servicio', id]);
  }

  onBuscarEventos(term: string): void {
    this.searchTerm = term ?? '';
    this.aplicarFiltroEventos();
  }

  abrirRegistroEvento(): void {
    const dialogRef = this.dialog.open(AddEventoComponent, { width: '420px' });
    dialogRef.afterClosed().subscribe((shouldReload) => {
      if (shouldReload) {
        this.cargarEventos();
      }
    });
  }

  imagenDe(nombre: string): string {
    const slug = (nombre || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
    return `assets/images/${slug || 'default'}.jpg`;
  }

  private cargarEventos(): void {
    this.loadingEventos = true;
    this.dataService.getEventos()
      .pipe(finalize(() => {
        this.loadingEventos = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (eventos) => {
          this.eventos = eventos ?? [];
          this.aplicarFiltroEventos();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando eventos', err);
          this.eventos = [];
          this.eventosFiltrados = [];
          this.cdr.markForCheck();
        }
      });
  }

  private aplicarFiltroEventos(): void {
    const term = this.normalizarTexto(this.searchTerm);

    if (!term) {
      this.eventosFiltrados = [...this.eventos];
    } else {
      this.eventosFiltrados = this.eventos.filter(evento =>
        this.normalizarTexto(evento.nombre).includes(term)
      );
    }
    this.cdr.markForCheck();
  }

  private normalizarTexto(valor: string): string {
    return (valor || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
