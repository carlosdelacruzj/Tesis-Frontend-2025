import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { forkJoin, interval, startWith, Subscription, switchMap } from 'rxjs';
import {
  DashboardAlertasResponse,
  DashboardCapacidadResponse,
  DashboardEstadoConteo,
  DashboardKpisResponse,
  DashboardResumenResponse,
  OperacionesAgendaResponse
} from './model/dashboard.model';
import { DashboardService } from './service/dashboard.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private refrescoLigeroSub: Subscription | null = null;

  fromDate = '';
  toDate = '';

  cargandoLigero = false;
  cargandoAgendaCapacidad = false;
  cargandoKpis = false;
  errorLigero = '';
  errorAgendaCapacidad = '';
  errorKpis = '';

  resumen: DashboardResumenResponse | null = null;
  alertas: DashboardAlertasResponse | null = null;
  agenda: OperacionesAgendaResponse | null = null;
  capacidad: DashboardCapacidadResponse | null = null;
  kpis: DashboardKpisResponse | null = null;

  ngOnInit(): void {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    this.fromDate = this.toIsoDateOnly(inicioMes);
    this.toDate = this.toIsoDateOnly(finMes);

    this.cargarResumenYAlertas();
    this.cargarAgendaYCapacidad();
    this.cargarKpis();
    this.iniciarRefrescoLigero();
  }

  ngOnDestroy(): void {
    if (this.refrescoLigeroSub) {
      this.refrescoLigeroSub.unsubscribe();
      this.refrescoLigeroSub = null;
    }
  }

  iniciarRefrescoLigero(): void {
    if (this.refrescoLigeroSub) {
      this.refrescoLigeroSub.unsubscribe();
      this.refrescoLigeroSub = null;
    }

    this.refrescoLigeroSub = interval(90000)
      .pipe(
        startWith(0),
        switchMap(() => this.dashboardService.getDashboardResumen())
      )
      .subscribe({
        next: (resumen) => {
          this.resumen = resumen;
          this.errorLigero = '';
        },
        error: () => {
          this.errorLigero = 'No se pudo refrescar el resumen automaticamente.';
        }
      });
  }

  refrescarTodo(): void {
    this.cargarResumenYAlertas();
    this.cargarAgendaYCapacidad();
    this.cargarKpis();
  }

  aplicarRango(): void {
    if (!this.fromDate || !this.toDate) {
      this.errorAgendaCapacidad = 'Debes indicar fecha inicial y fecha final.';
      return;
    }
    if (this.fromDate > this.toDate) {
      this.errorAgendaCapacidad = 'La fecha inicial no puede ser mayor que la fecha final.';
      return;
    }
    this.cargarAgendaYCapacidad();
  }

  private cargarResumenYAlertas(): void {
    this.cargandoLigero = true;
    this.errorLigero = '';
    forkJoin({
      resumen: this.dashboardService.getDashboardResumen(),
      alertas: this.dashboardService.getDashboardAlertas()
    }).subscribe({
      next: (response) => {
        this.resumen = response.resumen;
        this.alertas = response.alertas;
        this.cargandoLigero = false;
      },
      error: () => {
        this.cargandoLigero = false;
        this.errorLigero = 'No se pudo cargar resumen y alertas del dashboard.';
      }
    });
  }

  private cargarAgendaYCapacidad(): void {
    this.cargandoAgendaCapacidad = true;
    this.errorAgendaCapacidad = '';
    forkJoin({
      agenda: this.dashboardService.getAgenda(this.fromDate, this.toDate),
      capacidad: this.dashboardService.getCapacidad(this.fromDate, this.toDate)
    }).subscribe({
      next: (response) => {
        this.agenda = {
          ...response.agenda,
          resumenPorFecha: [...(response.agenda.resumenPorFecha ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha)),
          agenda: {
            proyectoDias: [...(response.agenda.agenda?.proyectoDias ?? [])].sort((a, b) => {
              if (a.fecha === b.fecha) return a.proyecto.localeCompare(b.proyecto);
              return a.fecha.localeCompare(b.fecha);
            }),
            pedidoEventos: [...(response.agenda.agenda?.pedidoEventos ?? [])].sort((a, b) => {
              if (a.fecha === b.fecha) return (a.hora || '').localeCompare(b.hora || '');
              return a.fecha.localeCompare(b.fecha);
            })
          }
        };
        this.capacidad = {
          ...response.capacidad,
          capacidadPorDia: [...(response.capacidad.capacidadPorDia ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha))
        };
        this.cargandoAgendaCapacidad = false;
      },
      error: () => {
        this.cargandoAgendaCapacidad = false;
        this.errorAgendaCapacidad = 'No se pudo cargar agenda y capacidad para el rango seleccionado.';
      }
    });
  }

  private cargarKpis(): void {
    this.cargandoKpis = true;
    this.errorKpis = '';
    this.dashboardService.getDashboardKpis().subscribe({
      next: (response) => {
        this.kpis = response;
        this.cargandoKpis = false;
      },
      error: () => {
        this.cargandoKpis = false;
        this.errorKpis = 'No se pudo cargar el analisis de KPIs.';
      }
    });
  }

  getEstadoListaTotal(lista: DashboardEstadoConteo[] | undefined): number {
    return (lista ?? []).reduce((acc, row) => acc + (row.total ?? 0), 0);
  }

  getPrioridadClass(prioridad: string | null | undefined): string {
    const value = (prioridad ?? '').toLowerCase();
    if (value === 'alta') return 'priority-high';
    if (value === 'media') return 'priority-medium';
    return 'priority-low';
  }

  getSaturacionClass(value: number): string {
    if (value >= 90) return 'sat-critical';
    if (value >= 80) return 'sat-high';
    if (value >= 60) return 'sat-medium';
    return 'sat-ok';
  }

  formatFechaCorta(value: string | null | undefined): string {
    if (!value) return '-';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${day}-${month}-${year}`;
  }

  formatFechaLarga(value: string | null | undefined): string {
    if (!value) return '-';
    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!year || !month || !day) return value;
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  toIsoDateOnly(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
