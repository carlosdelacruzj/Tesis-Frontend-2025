import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import {
  DashboardCapacidadPorDia,
  DashboardEstadoConteo,
  DashboardHomeResponse,
  OperacionesAgendaPedidoEvento,
  OperacionesAgendaProyectoDia
} from './model/dashboard.model';
import { DashboardService } from './service/dashboard.service';

interface AgendaDiaAgrupada {
  fecha: string;
  proyectoDias: OperacionesAgendaProyectoDia[];
  pedidoEventos: OperacionesAgendaPedidoEvento[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);

  private autoRefreshSub: Subscription | null = null;
  private requestSub: Subscription | null = null;

  readonly horizonOptions = [7, 14, 30];
  agendaDays = 14;

  isInitialLoading = true;
  isRefreshing = false;
  errorMessage = '';

  dashboardHome: DashboardHomeResponse | null = null;
  agendaPorDia: AgendaDiaAgrupada[] = [];

  ngOnInit(): void {
    this.loadDashboard(true);
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.autoRefreshSub?.unsubscribe();
    this.requestSub?.unsubscribe();
  }

  private startAutoRefresh(): void {
    this.autoRefreshSub?.unsubscribe();
    this.autoRefreshSub = interval(60000).subscribe(() => this.loadDashboard(false));
  }

  loadDashboard(showInitialLoader = false): void {
    if (showInitialLoader && !this.dashboardHome) {
      this.isInitialLoading = true;
    } else {
      this.isRefreshing = true;
    }

    this.errorMessage = '';
    this.requestSub?.unsubscribe();
    this.requestSub = this.dashboardService.getDashboardHome(this.agendaDays).subscribe({
      next: (response) => {
        this.dashboardHome = response;
        this.agendaPorDia = this.buildAgendaByDate(
          response.dashboard.agenda.agenda.proyectoDias ?? [],
          response.dashboard.agenda.agenda.pedidoEventos ?? []
        );
        this.isInitialLoading = false;
        this.isRefreshing = false;
      },
      error: () => {
        this.isInitialLoading = false;
        this.isRefreshing = false;
        this.errorMessage = 'No se pudo cargar dashboard operativo';
      }
    });
  }

  onAgendaDaysChange(days: number): void {
    if (this.agendaDays === days) return;
    this.agendaDays = days;
    this.loadDashboard(false);
  }

  refreshNow(): void {
    this.loadDashboard(false);
  }

  onRetry(): void {
    this.loadDashboard(!this.dashboardHome);
  }

  onKpiClick(key: 'cotizacionesPorExpirar7d' | 'pedidosEnRiesgo7d' | 'equiposNoDevueltos' | 'proyectoListoSinLinkFinal'): void {
    if (key === 'cotizacionesPorExpirar7d') {
      this.router.navigate(['/home/gestionar-cotizaciones'], { queryParams: { alerta: 'por-expirar' } });
      return;
    }
    if (key === 'pedidosEnRiesgo7d') {
      this.router.navigate(['/home/gestionar-pedido'], { queryParams: { alerta: 'en-riesgo' } });
      return;
    }
    if (key === 'equiposNoDevueltos') {
      this.router.navigate(['/home/gestionar-proyecto'], { queryParams: { alerta: 'equipos-no-devueltos' } });
      return;
    }
    this.router.navigate(['/home/gestionar-proyecto'], { queryParams: { alerta: 'listo-sin-link-final' } });
  }

  goToCotizacion(cotizacionId: number): void {
    this.router.navigate(['/home/gestionar-cotizaciones'], {
      queryParams: { alerta: 'por-expirar', cotizacionId }
    });
  }

  goToPedido(pedidoId: number): void {
    this.router.navigate(['/home/gestionar-pedido/detalle', pedidoId]);
  }

  goToProyecto(proyectoId: number, diaId?: number): void {
    this.router.navigate(['/home/gestionar-proyecto', proyectoId], {
      queryParams: diaId ? { diaId } : undefined
    });
  }

  getEstadoListaTotal(lista: DashboardEstadoConteo[] | undefined): number {
    return (lista ?? []).reduce((acc, row) => acc + (row.total ?? 0), 0);
  }

  getPrioridadClass(prioridad: string | null | undefined): string {
    const value = (prioridad ?? '').toLowerCase();
    if (value === 'alta') return 'chip-red';
    if (value === 'media') return 'chip-amber';
    return 'chip-green';
  }

  getSaturacionClass(value: number): string {
    if (value >= 90) return 'level-red';
    if (value >= 80) return 'level-amber';
    return 'level-green';
  }

  getDiasEventoClass(days: number | null | undefined): string {
    if (days === null || days === undefined) return 'level-amber';
    if (days < 0) return 'level-red';
    if (days <= 3) return 'level-amber';
    return 'level-green';
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

  private buildAgendaByDate(
    proyectoDias: OperacionesAgendaProyectoDia[],
    pedidoEventos: OperacionesAgendaPedidoEvento[]
  ): AgendaDiaAgrupada[] {
    const byDate = new Map<string, AgendaDiaAgrupada>();

    for (const item of proyectoDias) {
      const current = byDate.get(item.fecha) ?? { fecha: item.fecha, proyectoDias: [], pedidoEventos: [] };
      current.proyectoDias.push(item);
      byDate.set(item.fecha, current);
    }

    for (const item of pedidoEventos) {
      const current = byDate.get(item.fecha) ?? { fecha: item.fecha, proyectoDias: [], pedidoEventos: [] };
      current.pedidoEventos.push(item);
      byDate.set(item.fecha, current);
    }

    return Array.from(byDate.values())
      .map((group) => ({
        ...group,
        proyectoDias: [...group.proyectoDias].sort((a, b) => a.proyecto.localeCompare(b.proyecto)),
        pedidoEventos: [...group.pedidoEventos].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  get capacidadPorDia(): DashboardCapacidadPorDia[] {
    return this.dashboardHome?.dashboard.capacidad.capacidadPorDia ?? [];
  }
}
