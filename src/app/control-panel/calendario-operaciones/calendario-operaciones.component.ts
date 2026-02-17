import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { CalendarioDiaDetalleItem, CalendarioDiaDetalleResponse, CalendarioDiaMensual, CalendarioMensualResponse } from './model/calendario-operaciones.model';
import { CalendarioOperacionesService } from './service/calendario-operaciones.service';

interface CalendarCell {
  date: Date;
  ymd: string;
  day: number;
  inCurrentMonth: boolean;
  info: CalendarioDiaMensual | null;
}

@Component({
  selector: 'app-calendario-operaciones',
  templateUrl: './calendario-operaciones.component.html',
  styleUrls: ['./calendario-operaciones.component.css']
})
export class CalendarioOperacionesComponent implements OnInit, OnDestroy {
  private readonly calendarioService = inject(CalendarioOperacionesService);
  private readonly destroy$ = new Subject<void>();

  readonly monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  readonly weekNames = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

  year: number;
  month: number;

  loadingMonth = false;
  loadingDay = false;
  monthError: string | null = null;
  dayError: string | null = null;

  mensual: CalendarioMensualResponse | null = null;
  calendarCells: CalendarCell[] = [];

  selectedDate: string | null = null;
  detalleDia: CalendarioDiaDetalleResponse | null = null;
  dayModalOpen = false;

  constructor() {
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth() + 1;
  }

  ngOnInit(): void {
    this.loadMonth();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get years(): number[] {
    const current = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, index) => current - 5 + index);
  }

  get monthTitle(): string {
    const monthName = this.monthNames[this.month - 1] ?? `Mes ${this.month}`;
    return `${monthName} ${this.year}`;
  }

  get resumenTotalProyectoDiasMes(): number {
    return this.mensual?.resumen?.totalProyectoDiasMes ?? 0;
  }

  get resumenTotalProyectosUnicosMes(): number {
    return this.mensual?.resumen?.totalProyectosUnicosMes ?? 0;
  }

  get resumenDiasConActividad(): number {
    return this.mensual?.resumen?.diasConActividad ?? 0;
  }

  onYearChange(value: string): void {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    this.year = parsed;
    this.loadMonth();
  }

  onMonthChange(value: string): void {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    this.month = parsed;
    this.loadMonth();
  }

  goToPreviousMonth(): void {
    if (this.month === 1) {
      this.month = 12;
      this.year -= 1;
    } else {
      this.month -= 1;
    }
    this.loadMonth();
  }

  goToNextMonth(): void {
    if (this.month === 12) {
      this.month = 1;
      this.year += 1;
    } else {
      this.month += 1;
    }
    this.loadMonth();
  }

  openDay(cell: CalendarCell): void {
    if (!cell.inCurrentMonth) {
      return;
    }
    this.selectedDate = cell.ymd;
    this.dayModalOpen = true;
    this.loadDay(cell.ymd);
  }

  closeDayModal(): void {
    this.dayModalOpen = false;
  }

  getEstadoClass(value: string | null | undefined): string {
    const estado = (value ?? '').toLowerCase().trim();
    if (estado.includes('en curso')) return 'chip-warning';
    if (estado.includes('terminado')) return 'chip-success';
    if (estado.includes('cancelado') || estado.includes('suspendido')) return 'chip-danger';
    return 'chip-neutral';
  }

  formatHora(value: string | null | undefined): string {
    if (!value) return '--:--';
    return value.slice(0, 5);
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${day}-${month}-${year}`;
  }

  trackByCalendarCell(index: number, cell: CalendarCell): string {
    return `${index}-${cell.ymd}`;
  }

  trackByDiaItem(_: number, item: CalendarioDiaDetalleItem): number {
    return item.diaId;
  }

  private loadMonth(): void {
    this.loadingMonth = true;
    this.monthError = null;
    this.calendarioService.getCalendarioMensual({ year: this.year, month: this.month })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.mensual = response;
          this.calendarCells = this.buildCalendarGrid(this.year, this.month, response?.dias ?? []);
          this.loadingMonth = false;
        },
        error: (error) => {
          console.error('[calendario-operaciones] mensual', error);
          this.loadingMonth = false;
          this.mensual = null;
          this.calendarCells = [];
          this.monthError = 'No se pudo cargar el calendario mensual.';
        }
      });
  }

  private loadDay(fecha: string): void {
    this.loadingDay = true;
    this.dayError = null;
    this.detalleDia = null;

    this.calendarioService.getCalendarioDia(fecha)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.detalleDia = response;
          this.loadingDay = false;
        },
        error: (error) => {
          console.error('[calendario-operaciones] dia', error);
          this.dayError = 'No se pudo cargar el detalle del dia.';
          this.loadingDay = false;
        }
      });
  }

  private buildCalendarGrid(year: number, month: number, daysInfo: CalendarioDiaMensual[]): CalendarCell[] {
    const dataMap = new Map(daysInfo.map(item => [item.fecha, item]));
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const cells: CalendarCell[] = [];
    for (let i = startOffset; i > 0; i -= 1) {
      const prevDate = new Date(year, month - 1, 1 - i);
      const ymd = this.toYmd(prevDate);
      cells.push({
        date: prevDate,
        ymd,
        day: prevDate.getDate(),
        inCurrentMonth: false,
        info: dataMap.get(ymd) ?? null
      });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const current = new Date(year, month - 1, day);
      const ymd = this.toYmd(current);
      cells.push({
        date: current,
        ymd,
        day,
        inCurrentMonth: true,
        info: dataMap.get(ymd) ?? null
      });
    }

    const remainder = cells.length % 7;
    const trailing = remainder === 0 ? 0 : 7 - remainder;
    for (let i = 1; i <= trailing; i += 1) {
      const nextDate = new Date(year, month - 1, totalDays + i);
      const ymd = this.toYmd(nextDate);
      cells.push({
        date: nextDate,
        ymd,
        day: nextDate.getDate(),
        inCurrentMonth: false,
        info: dataMap.get(ymd) ?? null
      });
    }

    return cells;
  }

  private toYmd(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
