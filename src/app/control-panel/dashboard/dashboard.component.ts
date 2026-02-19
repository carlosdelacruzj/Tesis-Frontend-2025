import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import {
  DashboardEstadoConteo,
  DashboardOperativoDiaResponse,
  DashboardOperacionDiaAgendaItem,
  DashboardOperativoDiaColaPendienteItem,
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

  isInitialLoading = true;
  isRefreshing = false;
  errorMessage = '';

  dashboardHome: DashboardOperativoDiaResponse | null = null;

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
    return this.dashboardHome?.range?.fromYmd ?? this.dashboardHome?.range?.from ?? null;
  }

  get rangeToYmd(): string | null {
    return this.dashboardHome?.range?.toYmd ?? this.dashboardHome?.range?.to ?? null;
  }

  get tarjetasHoy(): DashboardOperacionDiaTarjetas {
    const cards = this.dashboardHome?.cards;
    const cobros = this.dashboardHome?.resumenHoy?.cobrosHoy;
    const capacidad = this.dashboardHome?.capacidadHoy?.equipo;
    if (!cards) {
      return {
        serviciosProgramadosHoy: 0,
        eventosHoy: 0,
        proyectosEnCursoHoy: 0,
        proyectosPendientesInicioHoy: 0,
        equiposPorDevolverHoy: 0,
        pagosConSaldoHoy: 0
      };
    }
    return {
      serviciosProgramadosHoy: cards.serviciosProgramadosHoy ?? 0,
      eventosHoy: cards.eventosHoy ?? 0,
      proyectosEnCursoHoy: cards.eventosEnCursoHoy ?? 0,
      proyectosPendientesInicioHoy: cards.eventosPendientesInicioHoy ?? 0,
      equiposPorDevolverHoy: capacidad?.pendientesDevolucion ?? 0,
      pagosConSaldoHoy: cobros?.pedidosConSaldo ?? 0
    };
  }

  get todayYmd(): string | null {
    return this.normalizeYmd(this.dashboardHome?.fecha) ?? this.normalizeYmd(new Date().toISOString());
  }

  get capacidadHoySegura() {
    const capacidad = this.dashboardHome?.capacidadHoy;
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
    return this.dashboardHome?.agendaHoy?.items ?? [];
  }

  get agendaHoyItemsVisibles(): DashboardOperacionDiaAgendaItem[] {
    return this.agendaHoyItems.filter(item => !this.isEstadoDiaCancelado(item.estadoDia));
  }

  get colaPendientesHoy(): DashboardOperativoDiaColaPendienteItem[] {
    return this.dashboardHome?.colaPendientesHoy?.items ?? [];
  }

  get colaPendientesHoyVisibles(): DashboardOperativoDiaColaPendienteItem[] {
    const diaIdsCancelados = new Set(
      this.agendaHoyItems
        .filter(item => this.isEstadoDiaCancelado(item.estadoDia))
        .map(item => item.diaId)
    );
    return this.colaPendientesHoy.filter(item => !item.diaId || !diaIdsCancelados.has(item.diaId));
  }

  get totalProyectosHoy(): number {
    return this.dashboardHome?.resumenHoy?.totalProyectosConDiaHoy ?? 0;
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
    const estado = this.dashboardHome?.resumenHoy?.estadoDia;
    if (!estado) {
      return [];
    }
    return [
      { id: 1, nombre: 'Pendiente', total: estado.pendiente ?? 0 },
      { id: 2, nombre: 'En curso', total: estado.enCurso ?? 0 },
      { id: 3, nombre: 'Terminado', total: estado.terminado ?? 0 },
      { id: 4, nombre: 'Suspendido', total: estado.suspendido ?? 0 },
      { id: 5, nombre: 'Cancelado', total: estado.cancelado ?? 0 }
    ].filter(item => item.total > 0);
  }

  get ocupacionHoyResumen() {
    return this.dashboardHome?.ocupacionHoy?.resumen ?? {
      personasOcupadas: 0,
      equiposOcupados: 0,
      capacidadStaffTotal: 0,
      capacidadEquipoTotal: 0,
      porcentajeStaffOcupado: 0,
      porcentajeEquipoOcupado: 0
    };
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

  private isEstadoDiaCancelado(estadoDia: string | null | undefined): boolean {
    const value = (estadoDia ?? '').toString().trim().toLowerCase();
    return value.startsWith('cancelad');
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
