import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, Subject, takeUntil } from 'rxjs';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import Swal from 'sweetalert2';
import { BloqueDia, ProyectoDetalle, ProyectoDetalleResponse, ProyectoPayload } from '../model/proyecto.model';
import { ProyectoService } from '../service/proyecto.service';

@Component({
  selector: 'app-detalle-proyecto',
  templateUrl: './detalle-proyecto.component.html',
  styleUrls: ['./detalle-proyecto.component.css']
})
export class DetalleProyectoComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly proyectoService = inject(ProyectoService);
  private readonly fb = inject(UntypedFormBuilder);

  loading = true;
  error: string | null = null;
  detalle: ProyectoDetalleResponse | null = null;
  proyecto: ProyectoDetalle | null = null;
  guardandoProyecto = false;
  modalAsignarAbierto = false;
  soloPendientes = false;
  openDiaId: number | null = null;

  proyectoForm: UntypedFormGroup = this.fb.group({
    responsableId: [null],
    notas: [''],
    enlace: ['']
  });
  eventosColumns = [
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'hora', header: 'Hora', sortable: true },
    { key: 'ubicacion', header: 'Locación', sortable: true },
    { key: 'direccion', header: 'Dirección', sortable: true },
    { key: 'notas', header: 'Notas', sortable: false }
  ];

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? +idParam : 0;

    if (!id) {
      this.error = 'Proyecto no encontrado.';
      this.loading = false;
      return;
    }

    this.proyectoService.getProyecto(id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.loading = false; })
      )
      .subscribe({
        next: (data) => {
          this.detalle = data;
          this.proyecto = data?.proyecto ?? null;
          if (!this.openDiaId) {
            const diaInicial = [...(data?.dias ?? [])]
              .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0];
            this.openDiaId = diaInicial?.diaId ?? null;
          }
          if (this.proyecto) {
            this.patchProyectoForm(this.proyecto);
          }
        },
        error: (err) => {
          console.error('[proyecto] detalle', err);
          this.error = 'No pudimos cargar el proyecto.';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  abrirModalAsignar(): void {
    this.modalAsignarAbierto = true;
  }

  cerrarModalAsignar(): void {
    this.modalAsignarAbierto = false;
  }

  guardarProyecto(): void {
    if (!this.proyecto?.proyectoId) return;
    if (this.proyectoForm.invalid) {
      this.proyectoForm.markAllAsTouched();
      return;
    }

    const raw = this.proyectoForm.value;
    const cambios: Partial<ProyectoPayload> = {};
    this.addIfChanged(cambios, 'responsableId', raw.responsableId, this.proyecto?.responsableId, 'number');
    this.addIfChanged(cambios, 'enlace', raw.enlace, this.proyecto?.enlace, 'string');
    this.addIfChanged(cambios, 'notas', raw.notas, this.proyecto?.notas, 'string');

    const keysCambios = Object.keys(cambios);
    if (!keysCambios.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sin cambios',
        text: 'No hay campos modificados para enviar.'
      });
      return;
    }

    this.guardandoProyecto = true;
    this.proyectoService.actualizarProyectoParcial(this.proyecto.proyectoId, cambios)
      .pipe(finalize(() => { this.guardandoProyecto = false; }))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Proyecto actualizado',
            timer: 1600,
            showConfirmButton: false
          });
          this.proyecto = {
            ...this.proyecto,
            ...cambios
          } as ProyectoDetalle;
        },
        error: (err) => {
          console.error('[proyecto] actualizar parcial', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo actualizar',
            text: 'Intenta nuevamente.'
          });
        }
      });
  }

  formatFechaDisplay(value: string | Date | null | undefined): string {
    if (!value) return '—';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/); // YYYY-MM-DD
      if (match) {
        const [, y, m, d] = match;
        return `${d}-${m}-${y}`;
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const year = parsed.getUTCFullYear();
        return `${day}-${month}-${year}`;
      }
      return '—';
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}-${month}-${year}`;
  }

  formatFechaLarga(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(parsed);
  }

  formatHora12(value: string | null | undefined): string {
    if (!value) return '—';
    const raw = String(value);
    let date: Date;
    if (raw.includes('T')) {
      date = new Date(raw);
    } else {
      const base = '1970-01-01';
      date = new Date(`${base}T${raw}`);
    }
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-PE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  getServiciosDia(diaId: number): ProyectoDetalleResponse['serviciosDia'] {
    const lista = this.detalle?.serviciosDia ?? [];
    return lista.filter(item => item.diaId === diaId);
  }

  getBloquesDia(diaId: number): BloqueDia[] {
    const lista = this.detalle?.bloquesDia ?? [];
    return lista
      .filter(item => item.diaId === diaId)
      .sort((a, b) => this.toSafeNumber(a.orden) - this.toSafeNumber(b.orden));
  }

  getBloquesCount(diaId: number): number {
    return this.getBloquesDia(diaId).length;
  }

  getRangoHorasDia(diaId: number): { inicio: string; fin: string } | null {
    const bloques = this.getBloquesDia(diaId);
    if (!bloques.length) return null;
    const tiempos = bloques
      .map(b => this.toMinutes(b.hora))
      .filter(n => n !== null) as number[];
    if (!tiempos.length) return null;
    const min = Math.min(...tiempos);
    const max = Math.max(...tiempos);
    return {
      inicio: this.formatHora12(this.fromMinutes(min)),
      fin: this.formatHora12(this.fromMinutes(max))
    };
  }

  get totalDias(): number {
    return this.detalle?.dias?.length ?? 0;
  }

  get totalServiciosDia(): number {
    return this.detalle?.serviciosDia?.length ?? 0;
  }

  get totalEmpleadosDia(): number {
    return this.detalle?.empleadosDia?.length ?? 0;
  }

  get totalEquiposDia(): number {
    return this.detalle?.equiposDia?.length ?? 0;
  }

  toggleSoloPendientes(): void {
    this.soloPendientes = !this.soloPendientes;
    const dias = [...(this.detalle?.dias ?? [])]
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const filtrados = this.soloPendientes
      ? dias.filter(d => (d.estadoDiaNombre ?? '').toString().trim().toLowerCase() === 'pendiente')
      : dias;
    this.openDiaId = filtrados[0]?.diaId ?? null;
  }

  onToggleDia(diaId: number, event: Event): void {
    const target = event.target as HTMLDetailsElement | null;
    if (!target) return;
    this.openDiaId = target.open ? diaId : (this.openDiaId === diaId ? null : this.openDiaId);
  }

  getPendientesDia(diaId: number): { personal: number; equipos: number } {
    const reqPersonal = (this.detalle?.requerimientosPersonalDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce((sum, r) => sum + this.toSafeNumber(r.cantidad), 0);
    const reqEquipos = (this.detalle?.requerimientosEquipoDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce((sum, r) => sum + this.toSafeNumber(r.cantidad), 0);

    const asignPersonal = (this.detalle?.empleadosDia ?? []).filter(r => r.diaId === diaId).length;
    const asignEquipos = (this.detalle?.equiposDia ?? []).filter(r => r.diaId === diaId).length;

    return {
      personal: Math.max(this.toSafeNumber(reqPersonal) - asignPersonal, 0),
      equipos: Math.max(this.toSafeNumber(reqEquipos) - asignEquipos, 0)
    };
  }

  getServiciosCountDia(diaId: number): number {
    return (this.detalle?.serviciosDia ?? []).filter(item => item.diaId === diaId).length;
  }

  getReqPersonalCountDia(diaId: number): number {
    return (this.detalle?.requerimientosPersonalDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce((sum, r) => sum + this.toSafeNumber(r.cantidad), 0);
  }

  getReqEquiposCountDia(diaId: number): number {
    return (this.detalle?.requerimientosEquipoDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce((sum, r) => sum + this.toSafeNumber(r.cantidad), 0);
  }

  getAsignadosPersonalDia(diaId: number): number {
    return (this.detalle?.empleadosDia ?? []).filter(r => r.diaId === diaId).length;
  }

  getAsignadosEquiposDia(diaId: number): number {
    return (this.detalle?.equiposDia ?? []).filter(r => r.diaId === diaId).length;
  }

  getEstadoAsignacionDia(diaId: number): 'Sin asignar' | 'Pendiente' | 'Completo' | '—' {
    const reqPersonal = this.getReqPersonalCountDia(diaId);
    const reqEquipos = this.getReqEquiposCountDia(diaId);
    const asignPersonal = this.getAsignadosPersonalDia(diaId);
    const asignEquipos = this.getAsignadosEquiposDia(diaId);

    if ((reqPersonal + reqEquipos) === 0) return '—';
    if ((asignPersonal + asignEquipos) === 0) return 'Sin asignar';
    const pendientes = this.getPendientesDia(diaId);
    if (pendientes.personal > 0 || pendientes.equipos > 0) return 'Pendiente';
    return 'Completo';
  }

  getPendientesPersonalPorRol(diaId: number): { rol: string; requerido: number; asignado: number; pendiente: number }[] {
    const requeridos = (this.detalle?.requerimientosPersonalDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.rol ?? '').toString().trim() || 'Sin rol';
        acc[key] = (acc[key] ?? 0) + this.toSafeNumber(r.cantidad);
        return acc;
      }, {});

    const asignados = (this.detalle?.empleadosDia ?? [])
      .filter(r => r.diaId === diaId && !!(r as { rol?: string }).rol)
      .reduce<Record<string, number>>((acc, r) => {
        const key = ((r as { rol?: string }).rol ?? '').toString().trim() || 'Sin rol';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

    return Object.keys(requeridos).map(rol => {
      const requerido = requeridos[rol] ?? 0;
      const asignado = asignados[rol] ?? 0;
      return {
        rol,
        requerido,
        asignado,
        pendiente: Math.max(requerido - asignado, 0)
      };
    }).sort((a, b) => b.pendiente - a.pendiente);
  }

  getPendientesEquiposPorTipo(diaId: number): { tipo: string; requerido: number; asignado: number; pendiente: number }[] {
    const requeridos = (this.detalle?.requerimientosEquipoDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.tipoEquipoNombre ?? '').toString().trim() || 'Sin tipo';
        acc[key] = (acc[key] ?? 0) + this.toSafeNumber(r.cantidad);
        return acc;
      }, {});

    const asignados = (this.detalle?.equiposDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.tipoEquipo ?? '').toString().trim() || 'Sin tipo';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

    return Object.keys(requeridos).map(tipo => {
      const requerido = requeridos[tipo] ?? 0;
      const asignado = asignados[tipo] ?? 0;
      return {
        tipo,
        requerido,
        asignado,
        pendiente: Math.max(requerido - asignado, 0)
      };
    }).sort((a, b) => b.pendiente - a.pendiente);
  }

  isRolDataDisponible(diaId: number): boolean {
    return (this.detalle?.empleadosDia ?? []).some(r => r.diaId === diaId && !!(r as { rol?: string }).rol);
  }

  getServiceColorClass(nombre: string | null | undefined): string {
    const text = (nombre ?? '').toString();
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % 4;
    return ['chip-a', 'chip-b', 'chip-c', 'chip-d'][idx];
  }

  get pendientesTotales(): { personal: number; equipos: number } {
    const dias = this.detalle?.dias ?? [];
    return dias.reduce(
      (acc, dia) => {
        const p = this.getPendientesDia(dia.diaId);
        acc.personal += p.personal;
        acc.equipos += p.equipos;
        return acc;
      },
      { personal: 0, equipos: 0 }
    );
  }

  get diasTimeline(): ProyectoDetalleResponse['dias'] {
    const dias = [...(this.detalle?.dias ?? [])].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    if (!this.soloPendientes) return dias;
    return dias.filter(d => (d.estadoDiaNombre ?? '').toString().trim().toLowerCase() === 'pendiente');
  }

  toDateInput(value: string | Date | null | undefined): string {
    if (!value) return '';
    if (value instanceof Date) {
      const iso = value.toISOString();
      return iso.split('T')[0];
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
  }

  private normalizeValue(value: unknown, type: 'string' | 'number' | 'date'): string | number | null {
    if (type === 'number') return this.toNumberOrNull(value);
    if (type === 'date') {
      if (value === null || value === undefined) return null;
      if (value instanceof Date || typeof value === 'string') {
        return this.toDateInput(value);
      }
      return null;
    }
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    const coerced = String(value).trim();
    return coerced === '' ? null : coerced;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  private toSafeNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private toMinutes(value: string | null | undefined): number | null {
    if (!value) return null;
    const raw = String(value);
    const parts = raw.split(':');
    if (parts.length < 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return (h * 60) + m;
  }

  private fromMinutes(value: number): string {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }

  private addIfChanged(
    target: Partial<ProyectoPayload>,
    key: keyof ProyectoPayload,
    formValue: unknown,
    currentValue: unknown,
    type: 'string' | 'number' | 'date'
  ): void {
    const control = this.proyectoForm.get(key as string);
    if (!control || !control.dirty) return;
    const normalizedForm = this.normalizeValue(formValue, type);
    const normalizedCurrent = this.normalizeValue(currentValue, type);
    if (normalizedForm !== normalizedCurrent) {
      (target as Record<string, unknown>)[key as string] = normalizedForm;
    }
  }

  private patchProyectoForm(data: ProyectoDetalle): void {
    this.proyectoForm.patchValue({
      responsableId: data.responsableId,
      notas: data.notas,
      enlace: data.enlace
    });
  }


}
