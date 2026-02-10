import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import {
  DashboardEstadoConteo,
  DashboardHomeResponse,
  DashboardOperacionDiaAgendaItem,
  DashboardOperacionDiaColaPendienteItem,
  DashboardOperacionDiaTarjetas
} from './model/dashboard.model';
import { DashboardService } from './service/dashboard.service';

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
    this.requestSub = this.dashboardService.getDashboardHome().subscribe({
      next: (response) => {
        this.dashboardHome = response;
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

  goToCotizaciones(): void {
    this.router.navigate(['/home/gestionar-cotizaciones']);
  }

  goToPedidos(): void {
    this.router.navigate(['/home/gestionar-pedido']);
  }

  goToProyectos(): void {
    this.router.navigate(['/home/gestionar-proyecto']);
  }

  goToPagos(): void {
    this.router.navigate(['/home/pagos-estandar']);
  }

  goToProyecto(proyectoId: number, diaId?: number | null): void {
    this.router.navigate(['/home/gestionar-proyecto', proyectoId], {
      queryParams: diaId ? { diaId } : undefined
    });
  }

  goToPedido(pedidoId: number): void {
    this.router.navigate(['/home/gestionar-pedido/detalle', pedidoId]);
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
    if (value >= 90) return 'chip-red';
    if (value >= 80) return 'chip-amber';
    return 'chip-green';
  }

  getRiesgoClass(riesgoCount: number): string {
    if (riesgoCount >= 2) return 'chip-red';
    if (riesgoCount === 1) return 'chip-amber';
    return 'chip-green';
  }

  formatFechaCorta(value: string | null | undefined): string {
    if (!value) return '-';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${day}-${month}-${year}`;
  }

  formatHora(value: string | null | undefined): string {
    if (!value) return '--:--';
    return value.slice(0, 5);
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

  get rangeFromYmd(): string | null {
    return this.dashboardHome?.range?.fromYmd ?? this.dashboardHome?.dashboard?.agenda?.range?.from ?? null;
  }

  get rangeToYmd(): string | null {
    return this.dashboardHome?.range?.toYmd ?? this.dashboardHome?.dashboard?.agenda?.range?.to ?? null;
  }

  get tarjetasHoy(): DashboardOperacionDiaTarjetas {
    return this.dashboardHome?.operacionDia?.tarjetas ?? {
      serviciosProgramadosHoy: 0,
      eventosHoy: 0,
      proyectosEnCursoHoy: 0,
      proyectosPendientesInicioHoy: 0,
      equiposPorDevolverHoy: 0,
      pagosConSaldoHoy: 0
    };
  }

  get todayYmd(): string | null {
    return this.normalizeYmd(this.dashboardHome?.operacionDia?.fecha) ?? this.normalizeYmd(new Date().toISOString());
  }

  private get fechaPorDiaId(): Map<number, string> {
    const result = new Map<number, string>();
    const proyectoDias = this.dashboardHome?.dashboard?.agenda?.agenda?.proyectoDias ?? [];
    proyectoDias.forEach(dia => {
      const ymd = this.normalizeYmd(dia?.fecha);
      if (ymd) {
        result.set(dia.diaId, ymd);
      }
    });
    return result;
  }

  get capacidadHoySegura() {
    const capacidad = this.dashboardHome?.operacionDia?.capacidadHoy;
    const fechaHoy = this.todayYmd;
    const fechaCapacidad = this.normalizeYmd(capacidad?.fecha);
    if (!capacidad || !fechaHoy || fechaCapacidad !== fechaHoy) {
      return {
        staff: { usado: 0, saturacionPct: 0 },
        equipo: { usado: 0, saturacionPct: 0 }
      };
    }
    return capacidad;
  }

  get agendaHoyItems(): DashboardOperacionDiaAgendaItem[] {
    const items = this.dashboardHome?.operacionDia?.agendaHoy?.items ?? [];
    if (!items.length) {
      return [];
    }

    const fechaHoy = this.todayYmd;
    if (!fechaHoy) {
      return [];
    }

    const fechaPorDiaId = this.fechaPorDiaId;
    if (!fechaPorDiaId.size) {
      return [];
    }

    return items.filter(item => fechaPorDiaId.get(item.diaId) === fechaHoy);
  }

  get colaPendientesHoy(): DashboardOperacionDiaColaPendienteItem[] {
    const items = this.dashboardHome?.operacionDia?.colaPendientesHoy ?? [];
    if (!items.length) {
      return [];
    }
    const fechaHoy = this.todayYmd;
    if (!fechaHoy) {
      return [];
    }
    const fechaPorDiaId = this.fechaPorDiaId;
    return items.filter(item => {
      if (!item.diaId) {
        return true;
      }
      return fechaPorDiaId.get(item.diaId) === fechaHoy;
    });
  }

  get totalProyectosHoy(): number {
    return new Set(this.agendaHoyItems.map(item => item.proyectoId)).size;
  }

  get totalPedidosHoy(): number {
    return new Set(this.agendaHoyItems.map(item => item.pedidoId)).size;
  }

  get estadosProyectoHoy(): DashboardEstadoConteo[] {
    return this.groupEstado(this.agendaHoyItems.map(item => item.estadoProyecto));
  }

  get estadosPedidoHoy(): DashboardEstadoConteo[] {
    return this.groupEstado(this.agendaHoyItems.map(item => item.estadoPedido));
  }

  get estadosDiaHoy(): DashboardEstadoConteo[] {
    return this.groupEstado(this.agendaHoyItems.map(item => item.estadoDia));
  }

  private groupEstado(values: Array<string | null | undefined>): DashboardEstadoConteo[] {
    const map = new Map<string, number>();
    values.forEach(value => {
      const nombre = (value ?? '').toString().trim();
      if (!nombre) {
        return;
      }
      map.set(nombre, (map.get(nombre) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([nombre, total], index) => ({ id: index + 1, nombre, total }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  }

  private normalizeYmd(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const raw = value.toString().trim();
    if (!raw) {
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const parsed = new Date(raw.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString().slice(0, 10);
  }
}
