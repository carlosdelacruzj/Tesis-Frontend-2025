import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, Subject, takeUntil } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';
import {
  BloqueDia,
  IncidenciaDia,
  ProyectoAsignacionEmpleadoPayload,
  ProyectoAsignacionEquipoPayload,
  ProyectoAsignacionesDisponiblesEquipo,
  ProyectoAsignacionesDisponiblesEmpleado,
  ProyectoAsignacionesPayload,
  ProyectoDetalle,
  ProyectoDia,
  ProyectoDetalleResponse,
  ProyectoEstadoDevolucion,
  ProyectoDevolucionEquiposPayload,
  ProyectoDevolucionEquipoItem,
  ServicioDia
} from '../model/proyecto.model';
import { ProyectoService } from '../service/proyecto.service';

type EstadoAsignacionDia = 'Sin asignar' | 'Pendiente' | 'Completo' | '—';

type IncidenciaResumen = {
  tipo: string;
  descripcion: string;
  incidenciaId: number;
  createdAt: string;
  empleadoNombre?: string | null;
  empleadoCargo?: string | null;
  empleadoReemplazoNombre?: string | null;
  empleadoReemplazoCargo?: string | null;
};

type DiaResumen = {
  bloquesCount: number;
  serviciosCount: number;
  reqPersonal: number;
  reqEquipos: number;
  asignPersonal: number;
  asignEquipos: number;
  pendientesPersonal: number;
  pendientesEquipos: number;
  estadoAsignacion: EstadoAsignacionDia;
  rangoHoras: { inicio: string; fin: string } | null;
  incidenciasCount: number;
};

@Component({
  selector: 'app-detalle-proyecto',
  templateUrl: './detalle-proyecto.component.html',
  styleUrls: ['./detalle-proyecto.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetalleProyectoComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly proyectoService = inject(ProyectoService);

  loading = true;
  error: string | null = null;
  detalle: ProyectoDetalleResponse | null = null;
  proyecto: ProyectoDetalle | null = null;
  modalAsignarAbierto = false;
  modalIncidenciaAbierto = false;
  soloPendientes = false;
  openDiaId: number | null = null;
  asignacionDiaId: number | null = null;
  asignacionEmpleados: ProyectoAsignacionEmpleadoPayload[] = [];
  asignacionEquipos: ProyectoAsignacionEquipoPayload[] = [];
  disponiblesEmpleados: ProyectoAsignacionesDisponiblesEmpleado[] = [];
  disponiblesEquipos: ProyectoAsignacionesDisponiblesEquipo[] = [];
  cargandoDisponibles = false;
  guardandoAsignaciones = false;
  filtroRol: string | null = null;
  filtroTipoEquipo: string | null = null;
  searchEmpleado = '';
  searchEquipo = '';
  copiarDesdeDiaId: number | null = null;
  nuevoEmpleadoId: number | null = null;
  nuevoEquipoId: number | null = null;
  incidenciaDiaId: number | null = null;
  incidenciaTipo: 'PERSONAL_NO_ASISTE' | 'EQUIPO_FALLA_EN_EVENTO' | 'EQUIPO_ROBO_PERDIDA' | 'OTROS' | '' = '';
  incidenciaDescripcion = '';
  incidenciaEmpleadoId: number | null = null;
  incidenciaEmpleadoReemplazoId: number | null = null;
  incidenciaEquipoId: number | null = null;
  incidenciaEquipoReemplazoId: number | null = null;
  guardandoIncidencia = false;
  cargandoDisponiblesIncidencia = false;
  disponiblesIncidenciaEmpleados: ProyectoAsignacionesDisponiblesEmpleado[] = [];
  disponiblesIncidenciaEquipos: ProyectoAsignacionesDisponiblesEquipo[] = [];
  modalDevolucionAbierto = false;
  devolucionDiaId: number | null = null;
  devolucionDraft: Record<number, { estado: ProyectoEstadoDevolucion | ''; notas: string; fecha: string | null }> = {};
  guardandoDevolucion = false;
  stepperOrientation: 'horizontal' | 'vertical' = 'horizontal';
  ultimoDropDestino: number | 'reserva' | null = null;
  private dropHighlightTimer: number | null = null;
  tiposDetalleAbiertos: string[] = [];
  filtroModeloPorTipo: Record<string, string> = {};
  private diasOrdenadosCache: ProyectoDia[] = [];
  private bloquesDiaMap = new Map<number, BloqueDia[]>();
  private serviciosDiaMap = new Map<number, ServicioDia[]>();
  private incidenciasDiaMap = new Map<number, IncidenciaResumen[]>();
  private diaResumenMap = new Map<number, DiaResumen>();
  private asignacionesDraft: Record<number, {
    empleados: ProyectoAsignacionEmpleadoPayload[];
    equipos: ProyectoAsignacionEquipoPayload[];
  }> = {};
  private filtrosDraft: Record<number, {
    filtroRol: string | null;
    filtroTipoEquipo: string | null;
    searchEmpleado: string;
    searchEquipo: string;
    filtroModeloPorTipo: Record<string, string>;
    tiposDetalleAbiertos: string[];
  }> = {};

  eventosColumns = [
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'hora', header: 'Hora', sortable: true },
    { key: 'ubicacion', header: 'Locación', sortable: true },
    { key: 'direccion', header: 'Dirección', sortable: true },
    { key: 'notas', header: 'Notas', sortable: false }
  ];

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.updateStepperOrientation();
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
          this.rebuildDiaCaches();
          if (!this.openDiaId) {
            const diaInicial = [...(data?.dias ?? [])]
              .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0];
            this.openDiaId = diaInicial?.diaId ?? null;
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
    const diaId = this.openDiaId ?? this.detalle?.dias?.[0]?.diaId ?? null;
    this.setAsignacionDia(diaId);
  }

  cerrarModalAsignar(): void {
    this.saveAsignacionDraft();
    this.saveFiltrosDraft();
    this.modalAsignarAbierto = false;
  }

  abrirModalIncidencia(diaId?: number): void {
    this.modalIncidenciaAbierto = true;
    const selected = diaId ?? this.openDiaId ?? this.detalle?.dias?.[0]?.diaId ?? null;
    this.incidenciaDiaId = selected;
    this.resetIncidenciaForm(false);
    this.cargarDisponiblesIncidencia(selected);
  }

  irASeccion(sectionId: string): void {
    const section = typeof document !== 'undefined' ? document.getElementById(sectionId) : null;
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateStepperOrientation();
  }

  cerrarModalIncidencia(): void {
    this.modalIncidenciaAbierto = false;
  }

  setAsignacionDia(
    diaId: number | null,
    options?: { skipDraftSave?: boolean; forceDetalle?: boolean }
  ): void {
    if (!options?.skipDraftSave) {
      this.saveAsignacionDraft();
      this.saveFiltrosDraft();
    }
    this.asignacionDiaId = diaId;
    this.nuevoEmpleadoId = null;
    this.nuevoEquipoId = null;
    this.disponiblesEmpleados = [];
    this.disponiblesEquipos = [];
    this.asignacionEmpleados = [];
    this.asignacionEquipos = [];
    this.copiarDesdeDiaId = null;
    this.filtroRol = null;
    this.filtroTipoEquipo = null;
    this.searchEmpleado = '';
    this.searchEquipo = '';
    this.filtroModeloPorTipo = {};
    this.tiposDetalleAbiertos = [];
    if (!diaId || !this.detalle) {
      return;
    }
    const fuente = this.getAsignacionesDia(diaId, options?.forceDetalle);
    this.asignacionEmpleados = fuente.empleados;
    this.asignacionEquipos = fuente.equipos;
    this.loadFiltrosDraft(diaId);
    const fecha = this.detalle.dias?.find(d => d.diaId === diaId)?.fecha ?? null;
    if (fecha) {
      this.cargarDisponibles(fecha);
    }
  }

  cambiarDiaAsignacion(diaId: number | null): void {
    this.setAsignacionDia(diaId);
  }

  onEmpleadoSeleccionado(empleadoId: number | null): void {
    if (!empleadoId) return;
    if (!this.puedeAgregarEmpleado(empleadoId)) return;
    this.nuevoEmpleadoId = empleadoId;
    this.agregarEmpleado();
  }

  onEquipoSeleccionado(equipoId: number | null): void {
    if (!equipoId) return;
    if (!this.puedeAgregarEquipo(equipoId)) return;
    this.nuevoEquipoId = equipoId;
    this.agregarEquipo();
  }

  limpiarFiltrosAsignacion(): void {
    this.filtroRol = null;
    this.filtroTipoEquipo = null;
    this.searchEmpleado = '';
    this.searchEquipo = '';
    this.filtroModeloPorTipo = {};
  }

  hasFiltrosActivos(): boolean {
    return !!(this.filtroRol || this.filtroTipoEquipo || this.searchEmpleado || this.searchEquipo);
  }

  toggleFiltroRol(rol: string): void {
    this.filtroRol = this.filtroRol === rol ? null : rol;
  }

  toggleFiltroTipo(tipo: string): void {
    this.filtroTipoEquipo = this.filtroTipoEquipo === tipo ? null : tipo;
  }

  onIncidenciaTipoChange(tipo: 'PERSONAL_NO_ASISTE' | 'EQUIPO_FALLA_EN_EVENTO' | 'EQUIPO_ROBO_PERDIDA' | 'OTROS' | ''): void {
    this.incidenciaTipo = tipo;
    this.incidenciaEmpleadoId = null;
    this.incidenciaEmpleadoReemplazoId = null;
    this.incidenciaEquipoId = null;
    this.incidenciaEquipoReemplazoId = null;
  }

  resetIncidenciaForm(resetDia = true): void {
    if (resetDia) this.incidenciaDiaId = null;
    this.incidenciaTipo = '';
    this.incidenciaDescripcion = '';
    this.incidenciaEmpleadoId = null;
    this.incidenciaEmpleadoReemplazoId = null;
    this.incidenciaEquipoId = null;
    this.incidenciaEquipoReemplazoId = null;
  }

  canGuardarIncidencia(): boolean {
    if (!this.incidenciaDiaId) return false;
    if (!this.incidenciaTipo || !this.incidenciaDescripcion.trim()) return false;
    if (this.incidenciaTipo === 'PERSONAL_NO_ASISTE') {
      if (!this.incidenciaEmpleadoId || !this.incidenciaEmpleadoReemplazoId) return false;
      if (this.incidenciaEmpleadoId === this.incidenciaEmpleadoReemplazoId) return false;
    }
    if (this.incidenciaTipo === 'EQUIPO_FALLA_EN_EVENTO') {
      if (!this.incidenciaEquipoId || !this.incidenciaEquipoReemplazoId) return false;
      if (this.incidenciaEquipoId === this.incidenciaEquipoReemplazoId) return false;
    }
    if (this.incidenciaTipo === 'EQUIPO_ROBO_PERDIDA') {
      if (!this.incidenciaEquipoId) return false;
    }
    return true;
  }

  guardarIncidencia(): void {
    if (!this.incidenciaDiaId || !this.canGuardarIncidencia()) return;
    const payload = {
      tipo: this.incidenciaTipo as 'PERSONAL_NO_ASISTE' | 'EQUIPO_FALLA_EN_EVENTO' | 'EQUIPO_ROBO_PERDIDA' | 'OTROS',
      descripcion: this.incidenciaDescripcion.trim(),
      empleadoId: this.incidenciaEmpleadoId ?? null,
      empleadoReemplazoId: this.incidenciaEmpleadoReemplazoId ?? null,
      equipoId: this.incidenciaEquipoId ?? null,
      equipoReemplazoId: this.incidenciaEquipoReemplazoId ?? null,
    };
    this.guardandoIncidencia = true;
    this.proyectoService.crearIncidencia(this.incidenciaDiaId, payload)
      .pipe(finalize(() => { this.guardandoIncidencia = false; }))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Incidencia registrada',
            timer: 1600,
            showConfirmButton: false
          });
          if (!this.proyecto?.proyectoId) return;
          this.proyectoService.getProyecto(this.proyecto.proyectoId)
            .subscribe({
              next: data => {
                this.detalle = data;
                this.proyecto = data?.proyecto ?? null;
                this.rebuildDiaCaches();
              },
              error: err => {
                console.error('[proyecto] incidencias', err);
              }
            });
          this.resetIncidenciaForm();
          this.modalIncidenciaAbierto = false;
        },
        error: (err) => {
          console.error('[proyecto] incidencia', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo registrar',
            text: 'Intenta nuevamente.'
          });
        }
      });
  }

  agregarEmpleado(): void {
    if (!this.nuevoEmpleadoId) return;
    const exists = this.asignacionEmpleados.some(e => e.empleadoId === this.nuevoEmpleadoId);
    if (exists) return;
    this.asignacionEmpleados = [
      ...this.asignacionEmpleados,
      { empleadoId: this.nuevoEmpleadoId }
    ];
    this.nuevoEmpleadoId = null;
  }

  eliminarEmpleado(index: number): void {
    const removed = this.asignacionEmpleados[index]?.empleadoId ?? null;
    this.asignacionEmpleados = this.asignacionEmpleados.filter((_, i) => i !== index);
    if (removed) {
      // Limpia responsables de equipos que apuntaban al empleado removido.
      this.asignacionEquipos = this.asignacionEquipos.map(eq =>
        eq.responsableId === removed ? { ...eq, responsableId: null } : eq
      );
    }
  }

  agregarEquipo(): void {
    if (!this.nuevoEquipoId) return;
    const exists = this.asignacionEquipos.some(e => e.equipoId === this.nuevoEquipoId);
    if (exists) return;
    this.asignacionEquipos = [
      ...this.asignacionEquipos,
      { equipoId: this.nuevoEquipoId }
    ];
    this.nuevoEquipoId = null;
  }

  eliminarEquipo(index: number): void {
    this.asignacionEquipos = this.asignacionEquipos.filter((_, i) => i !== index);
  }

  onEquipoDrop(event: CdkDragDrop<unknown>, responsableId: number | null): void {
    const item = event.item?.data as ProyectoAsignacionEquipoPayload | undefined;
    if (!item) return;
    const target = responsableId ?? null;
    if (item.responsableId === target) return;
    item.responsableId = target;
    this.asignacionEquipos = [...this.asignacionEquipos];
    this.marcarDrop(target);
  }

  copiarAsignacionesDesde(diaId: number | null): void {
    if (!diaId || !this.asignacionDiaId || !this.detalle) return;
    const fuente = this.getAsignacionesDia(diaId);
    const empleadosSource = fuente.empleados;
    const equiposSource = fuente.equipos;

    const empleadosDisponibles = new Set(this.disponiblesEmpleados.map(e => e.empleadoId));
    const equiposDisponibles = new Set(this.disponiblesEquipos.map(e => e.equipoId));

    const empleadosFiltrados = empleadosSource.filter(e => empleadosDisponibles.has(e.empleadoId));
    const equiposFiltrados = equiposSource.filter(e => equiposDisponibles.has(e.equipoId));

    this.asignacionEmpleados = this.limitarEmpleadosPorRequerimiento(empleadosFiltrados, this.asignacionDiaId);
    const empleadosAsignadosSet = new Set(this.asignacionEmpleados.map(e => e.empleadoId));
    const equiposAjustados = equiposFiltrados.map(e => ({
      ...e,
      responsableId: e.responsableId && empleadosAsignadosSet.has(e.responsableId) ? e.responsableId : null
    }));
    this.asignacionEquipos = this.limitarEquiposPorRequerimiento(equiposAjustados, this.asignacionDiaId);
  }

  limpiarAsignacionesDia(): void {
    this.asignacionEmpleados = [];
    this.asignacionEquipos = [];
    this.saveAsignacionDraft();
  }

  guardarAsignacionesDia(): void {
    if (!this.proyecto?.proyectoId || !this.asignacionDiaId) return;
    const empleadosActuales = new Set(this.asignacionEmpleados.map(item => item.empleadoId));
    const payload: ProyectoAsignacionesPayload = {
      proyectoId: this.proyecto.proyectoId,
      dias: [
        {
          diaId: this.asignacionDiaId,
          empleados: this.asignacionEmpleados.map(item => ({ empleadoId: item.empleadoId })),
          equipos: this.asignacionEquipos.map(item => {
            const responsableValido = item.responsableId && empleadosActuales.has(item.responsableId);
            if (responsableValido) {
              return { equipoId: item.equipoId, responsableId: item.responsableId };
            }
            return { equipoId: item.equipoId };
          })
        }
      ]
    };

    this.guardandoAsignaciones = true;
    this.proyectoService.upsertAsignaciones(payload)
      .pipe(finalize(() => { this.guardandoAsignaciones = false; }))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Asignaciones guardadas',
            timer: 1600,
            showConfirmButton: false
          });
          if (!this.proyecto?.proyectoId) return;
          this.proyectoService.getProyecto(this.proyecto.proyectoId)
            .subscribe({
              next: data => {
                this.detalle = data;
                this.proyecto = data?.proyecto ?? null;
                this.rebuildDiaCaches();
                if (this.asignacionDiaId) {
                  delete this.asignacionesDraft[this.asignacionDiaId];
                }
                this.setAsignacionDia(this.asignacionDiaId, {
                  skipDraftSave: true,
                  forceDetalle: true
                });
              },
              error: err => {
                console.error('[proyecto] refrescar asignaciones', err);
              }
            });
        },
        error: (err) => {
          console.error('[proyecto] guardar asignaciones', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudieron guardar',
            text: 'Intenta nuevamente.'
          });
        }
      });
  }

  getDisponibleEmpleadoLabel(empleadoId: number): string {
    const found = this.disponiblesEmpleados.find(item => item.empleadoId === empleadoId);
    if (!found) return `Empleado #${empleadoId}`;
    return `${found.nombre} ${found.apellido} · ${found.cargo}`;
  }

  getDisponibleEquipoLabel(equipoId: number): string {
    const found = this.disponiblesEquipos.find(item => item.equipoId === equipoId);
    if (!found) return `Equipo #${equipoId}`;
    return `${found.nombreTipoEquipo} · ${found.nombreModelo} (${found.serie})`;
  }

  getDisponibleEquipoLabelSinTipo(equipoId: number): string {
    const found = this.disponiblesEquipos.find(item => item.equipoId === equipoId);
    if (!found) return `Equipo #${equipoId}`;
    return `${found.nombreModelo} (${found.serie})`;
  }

  isAsignacionDiaDirty(diaId: number | null): boolean {
    if (!diaId) return false;
    const actual = {
      empleados: this.asignacionEmpleados,
      equipos: this.asignacionEquipos
    };
    const backend = this.getAsignacionesDia(diaId, true);
    return !this.isAsignacionEqual(actual, backend);
  }

  descartarCambiosDia(): void {
    if (!this.asignacionDiaId) return;
    if (!this.isAsignacionDiaDirty(this.asignacionDiaId)) {
      this.applyDescartarCambios();
      return;
    }
    Swal.fire({
      icon: 'warning',
      title: 'Descartar cambios',
      text: 'Perderás los cambios no guardados de este día.',
      showCancelButton: true,
      confirmButtonText: 'Descartar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;
      this.applyDescartarCambios();
    });
  }

  private saveAsignacionDraft(): void {
    if (!this.asignacionDiaId) return;
    this.asignacionesDraft[this.asignacionDiaId] = {
      empleados: this.asignacionEmpleados.map(item => ({ ...item })),
      equipos: this.asignacionEquipos.map(item => ({ ...item }))
    };
  }

  private saveFiltrosDraft(): void {
    if (!this.asignacionDiaId) return;
    this.filtrosDraft[this.asignacionDiaId] = {
      filtroRol: this.filtroRol,
      filtroTipoEquipo: this.filtroTipoEquipo,
      searchEmpleado: this.searchEmpleado,
      searchEquipo: this.searchEquipo,
      filtroModeloPorTipo: { ...this.filtroModeloPorTipo },
      tiposDetalleAbiertos: [...this.tiposDetalleAbiertos]
    };
  }

  private loadFiltrosDraft(diaId: number): void {
    const filtros = this.filtrosDraft[diaId];
    if (!filtros) return;
    this.filtroRol = filtros.filtroRol;
    this.filtroTipoEquipo = filtros.filtroTipoEquipo;
    this.searchEmpleado = filtros.searchEmpleado;
    this.searchEquipo = filtros.searchEquipo;
    this.filtroModeloPorTipo = { ...filtros.filtroModeloPorTipo };
    this.tiposDetalleAbiertos = [...filtros.tiposDetalleAbiertos];
  }

  private isAsignacionEqual(
    a: { empleados: ProyectoAsignacionEmpleadoPayload[]; equipos: ProyectoAsignacionEquipoPayload[] },
    b: { empleados: ProyectoAsignacionEmpleadoPayload[]; equipos: ProyectoAsignacionEquipoPayload[] }
  ): boolean {
    const empA = a.empleados.map(item => item.empleadoId).sort((x, y) => x - y);
    const empB = b.empleados.map(item => item.empleadoId).sort((x, y) => x - y);
    if (empA.length !== empB.length) return false;
    for (let i = 0; i < empA.length; i += 1) {
      if (empA[i] !== empB[i]) return false;
    }
    const eqA = a.equipos
      .map(item => `${item.equipoId}:${item.responsableId ?? 0}`)
      .sort();
    const eqB = b.equipos
      .map(item => `${item.equipoId}:${item.responsableId ?? 0}`)
      .sort();
    if (eqA.length !== eqB.length) return false;
    for (let i = 0; i < eqA.length; i += 1) {
      if (eqA[i] !== eqB[i]) return false;
    }
    return true;
  }

  private applyDescartarCambios(): void {
    if (!this.asignacionDiaId) return;
    delete this.asignacionesDraft[this.asignacionDiaId];
    delete this.filtrosDraft[this.asignacionDiaId];
    this.setAsignacionDia(this.asignacionDiaId, {
      skipDraftSave: true,
      forceDetalle: true
    });
  }

  private getEquipoTipo(equipoId: number): string {
    const found = this.disponiblesEquipos.find(item => item.equipoId === equipoId);
    const tipo = (found?.nombreTipoEquipo ?? '').toString().trim();
    return tipo || 'Sin tipo';
  }

  isAsignacionDiaDirtyFor(diaId: number): boolean {
    if (this.asignacionDiaId === diaId) {
      return this.isAsignacionDiaDirty(diaId);
    }
    const draft = this.asignacionesDraft[diaId];
    if (!draft) return false;
    const backend = this.getAsignacionesDia(diaId, true);
    return !this.isAsignacionEqual(draft, backend);
  }

  private getAsignacionesDia(
    diaId: number,
    forceDetalle = false
  ): { empleados: ProyectoAsignacionEmpleadoPayload[]; equipos: ProyectoAsignacionEquipoPayload[] } {
    const draft = this.asignacionesDraft[diaId];
    if (draft && !forceDetalle) {
      return {
        empleados: draft.empleados.map(item => ({ ...item })),
        equipos: draft.equipos.map(item => ({ ...item }))
      };
    }
    const empleados = (this.detalle?.empleadosDia ?? [])
      .filter(item => item.diaId === diaId)
      .map(item => ({ empleadoId: item.empleadoId }));
    const equipos = (this.detalle?.equiposDia ?? [])
      .filter(item => item.diaId === diaId)
      .map(item => ({
        equipoId: item.equipoId,
        responsableId: item.responsableId ?? null
      }));
    return { empleados, equipos };
  }

  getEquiposReserva(): ProyectoAsignacionEquipoPayload[] {
    return this.asignacionEquipos.filter(item => !item.responsableId);
  }

  getEquiposReservaPorTipo(): { tipo: string; items: ProyectoAsignacionEquipoPayload[] }[] {
    const mapa: Record<string, ProyectoAsignacionEquipoPayload[]> = {};
    this.getEquiposReserva().forEach(item => {
      const tipo = this.getEquipoTipo(item.equipoId);
      if (!mapa[tipo]) {
        mapa[tipo] = [];
      }
      mapa[tipo].push(item);
    });
    return Object.keys(mapa)
      .sort((a, b) => a.localeCompare(b))
      .map(tipo => ({ tipo, items: mapa[tipo] }));
  }

  getIncidenciasDia(diaId: number): IncidenciaResumen[] {
    return this.incidenciasDiaMap.get(diaId) ?? [];
  }

  getIncidenciasCountDia(diaId: number): number {
    return this.getDiaResumen(diaId).incidenciasCount;
  }

  getEmpleadosDiaOptions(diaId: number): { empleadoId: number; empleadoNombre: string }[] {
    const items = (this.detalle?.empleadosDia ?? []).filter(item => item.diaId === diaId);
    const mapa = new Map<number, string>();
    items.forEach(item => {
      if (!mapa.has(item.empleadoId)) {
        mapa.set(item.empleadoId, item.empleadoNombre || `Empleado #${item.empleadoId}`);
      }
    });
    return Array.from(mapa.entries()).map(([empleadoId, empleadoNombre]) => ({ empleadoId, empleadoNombre }));
  }

  getEquiposDiaOptions(diaId: number): { equipoId: number; label: string }[] {
    const items = (this.detalle?.equiposDia ?? []).filter(item => item.diaId === diaId);
    const mapa = new Map<number, string>();
    items.forEach(item => {
      if (!mapa.has(item.equipoId)) {
        mapa.set(item.equipoId, `${item.modelo || 'Equipo'} (${item.equipoSerie || '—'})`);
      }
    });
    return Array.from(mapa.entries()).map(([equipoId, label]) => ({ equipoId, label }));
  }

  getEquiposAfectadosOptions(diaId: number): { equipoId: number; label: string }[] {
    const items = (this.detalle?.equiposDia ?? [])
      .filter(item => item.diaId === diaId)
      .filter(item => item.responsableId !== null && item.responsableId !== undefined);

    const mapa = new Map<number, string>();
    items.forEach(item => {
      if (!mapa.has(item.equipoId)) {
        mapa.set(item.equipoId, `${item.modelo || 'Equipo'} (${item.equipoSerie || '—'})`);
      }
    });
    return Array.from(mapa.entries()).map(([equipoId, label]) => ({ equipoId, label }));
  }

  getEquiposPorResponsable(empleadoId: number): ProyectoAsignacionEquipoPayload[] {
    return this.asignacionEquipos.filter(item => item.responsableId === empleadoId);
  }

  getEquiposCountResponsable(empleadoId: number): number {
    return this.getEquiposPorResponsable(empleadoId).length;
  }


  get dropListIds(): string[] {
    const ids = this.asignacionEmpleados.map(emp => `emp-${emp.empleadoId}`);
    ids.push('reserva');
    return ids;
  }

  getEmpleadosDisponiblesFiltrados(): ProyectoAsignacionesDisponiblesEmpleado[] {
    let lista = [...this.disponiblesEmpleados];
    if (this.filtroRol) {
      const rol = this.filtroRol.toLowerCase();
      lista = lista.filter(item => (item.cargo ?? '').toLowerCase() === rol);
    }
    const texto = this.searchEmpleado.trim().toLowerCase();
    if (texto) {
      lista = lista.filter(item =>
        `${item.nombre} ${item.apellido} ${item.cargo}`.toLowerCase().includes(texto)
      );
    }
    const seleccionados = new Set(this.asignacionEmpleados.map(item => item.empleadoId));
    return lista
      .filter(item => !seleccionados.has(item.empleadoId))
      .filter(item => this.puedeAgregarEmpleado(item.empleadoId))
      .sort((a, b) => {
        const aMatch = this.isRolRequerido(a.cargo);
        const bMatch = this.isRolRequerido(b.cargo);
        if (aMatch === bMatch) return 0;
        return aMatch ? -1 : 1;
      });
  }

  getEquiposDisponiblesFiltrados(): ProyectoAsignacionesDisponiblesEquipo[] {
    let lista = [...this.disponiblesEquipos];
    if (this.filtroTipoEquipo) {
      const tipo = this.filtroTipoEquipo.toLowerCase();
      lista = lista.filter(item => (item.nombreTipoEquipo ?? '').toLowerCase() === tipo);
    }
    const texto = this.searchEquipo.trim().toLowerCase();
    if (texto) {
      lista = lista.filter(item =>
        `${item.nombreTipoEquipo} ${item.nombreModelo} ${item.serie}`.toLowerCase().includes(texto)
      );
    }
    const seleccionados = new Set(this.asignacionEquipos.map(item => item.equipoId));
    return lista
      .filter(item => !seleccionados.has(item.equipoId))
      .filter(item => this.puedeAgregarEquipo(item.equipoId))
      .sort((a, b) => {
        const aMatch = this.isTipoRequerido(a.nombreTipoEquipo);
        const bMatch = this.isTipoRequerido(b.nombreTipoEquipo);
        if (aMatch === bMatch) return 0;
        return aMatch ? -1 : 1;
      });
  }

  getEquiposAsignadosPorTipo(tipo: string): ProyectoAsignacionEquipoPayload[] {
    const key = tipo.toLowerCase();
    return this.asignacionEquipos.filter(item => {
      const eq = this.disponiblesEquipos.find(e => e.equipoId === item.equipoId);
      return (eq?.nombreTipoEquipo ?? '').toLowerCase() === key;
    });
  }

  getEquiposDisponiblesPorTipo(tipo: string): ProyectoAsignacionesDisponiblesEquipo[] {
    const key = tipo.toLowerCase();
    const seleccionados = new Set(this.asignacionEquipos.map(item => item.equipoId));
    return this.disponiblesEquipos.filter(item =>
      (item.nombreTipoEquipo ?? '').toLowerCase() === key && !seleccionados.has(item.equipoId)
    );
  }

  getEquiposDisponiblesPorTipoFiltrados(tipo: string): ProyectoAsignacionesDisponiblesEquipo[] {
    const modeloFiltro = (this.filtroModeloPorTipo[tipo] ?? '').toLowerCase();
    const texto = this.searchEquipo.trim().toLowerCase();
    return this.getEquiposDisponiblesPorTipo(tipo).filter(eq => {
      const modelo = (eq.nombreModelo ?? '').toLowerCase();
      const serie = (eq.serie ?? '').toLowerCase();
      if (modeloFiltro && modelo !== modeloFiltro) return false;
      if (texto && !`${modelo} ${serie}`.includes(texto)) return false;
      return true;
    });
  }

  agregarEquipoPorTipo(tipo: string, requerido: number): void {
    if (this.tieneMultiplesModelos(tipo)) return;
    const asignados = this.getEquiposAsignadosPorTipo(tipo).length;
    if (asignados >= requerido) return;
    const disponibles = this.getEquiposDisponiblesPorTipo(tipo);
    const siguiente = disponibles[0];
    if (!siguiente) return;
    this.asignacionEquipos = [
      ...this.asignacionEquipos,
      { equipoId: siguiente.equipoId }
    ];
  }

  completarEquiposPorTipo(tipo: string, requerido: number): void {
    if (this.tieneMultiplesModelos(tipo)) return;
    let asignados = this.getEquiposAsignadosPorTipo(tipo).length;
    if (asignados >= requerido) return;
    const disponibles = this.getEquiposDisponiblesPorTipo(tipo);
    const toAdd = Math.min(requerido - asignados, disponibles.length);
    if (!toAdd) return;
    const nuevos = disponibles.slice(0, toAdd).map(eq => ({ equipoId: eq.equipoId }));
    this.asignacionEquipos = [...this.asignacionEquipos, ...nuevos];
    asignados += toAdd;
  }

  quitarEquipoPorTipo(tipo: string): void {
    const asignados = this.getEquiposAsignadosPorTipo(tipo);
    const ultimo = asignados[asignados.length - 1];
    if (!ultimo) return;
    this.asignacionEquipos = this.asignacionEquipos.filter(item => item !== ultimo);
  }

  toggleTipoDetalle(tipo: string): void {
    const idx = this.tiposDetalleAbiertos.indexOf(tipo);
    if (idx >= 0) {
      this.tiposDetalleAbiertos = this.tiposDetalleAbiertos.filter(t => t !== tipo);
    } else {
      this.tiposDetalleAbiertos = [...this.tiposDetalleAbiertos, tipo];
    }
  }

  isTipoDetalleAbierto(tipo: string): boolean {
    return this.tiposDetalleAbiertos.includes(tipo);
  }

  tieneMultiplesModelos(tipo: string): boolean {
    return this.getModelosPorTipo(tipo).length > 1;
  }

  getModelosPorTipo(tipo: string): string[] {
    const key = tipo.toLowerCase();
    const modelos = new Set(
      this.disponiblesEquipos
        .filter(eq => (eq.nombreTipoEquipo ?? '').toLowerCase() === key)
        .map(eq => eq.nombreModelo)
        .filter((m): m is string => !!m)
    );
    return Array.from(modelos).sort((a, b) => a.localeCompare(b));
  }

  setModeloFiltro(tipo: string, modelo: string): void {
    if (modelo) {
      this.filtroModeloPorTipo = { ...this.filtroModeloPorTipo, [tipo]: modelo };
    } else {
      const { [tipo]: _, ...rest } = this.filtroModeloPorTipo;
      this.filtroModeloPorTipo = rest;
    }
  }

  getModeloFiltro(tipo: string): string {
    return this.filtroModeloPorTipo[tipo] ?? '';
  }

  toggleEquipoSeleccion(equipoId: number, tipo: string, requerido: number): void {
    const idx = this.asignacionEquipos.findIndex(item => item.equipoId === equipoId);
    if (idx >= 0) {
      this.asignacionEquipos = this.asignacionEquipos.filter((_, i) => i !== idx);
      return;
    }
    const asignados = this.getEquiposAsignadosPorTipo(tipo).length;
    if (asignados >= requerido) return;
    this.asignacionEquipos = [...this.asignacionEquipos, { equipoId }];
  }

  isEquipoSeleccionado(equipoId: number): boolean {
    return this.asignacionEquipos.some(item => item.equipoId === equipoId);
  }

  getRequeridosPersonalPorRol(diaId: number): { rol: string; requerido: number; asignado: number }[] {
    const requeridos = (this.detalle?.requerimientosPersonalDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.rol ?? '').toString().trim() || 'Sin rol';
        acc[key] = (acc[key] ?? 0) + this.toSafeNumber(r.cantidad);
        return acc;
      }, {});

    const asignados = this.asignacionEmpleados.reduce<Record<string, number>>((acc, item) => {
      const emp = this.disponiblesEmpleados.find(e => e.empleadoId === item.empleadoId);
      const key = emp?.cargo ? emp.cargo.toString().trim() : 'Sin rol';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.keys(requeridos).map(rol => ({
      rol,
      requerido: requeridos[rol] ?? 0,
      asignado: asignados[rol] ?? 0
    }));
  }

  getRequeridosEquiposPorTipo(diaId: number): { tipo: string; requerido: number; asignado: number }[] {
    const requeridos = (this.detalle?.requerimientosEquipoDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.tipoEquipoNombre ?? '').toString().trim() || 'Sin tipo';
        acc[key] = (acc[key] ?? 0) + this.toSafeNumber(r.cantidad);
        return acc;
      }, {});

    const asignados = this.asignacionEquipos.reduce<Record<string, number>>((acc, item) => {
      const eq = this.disponiblesEquipos.find(e => e.equipoId === item.equipoId);
      const key = eq?.nombreTipoEquipo ? eq.nombreTipoEquipo.toString().trim() : 'Sin tipo';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.keys(requeridos).map(tipo => ({
      tipo,
      requerido: requeridos[tipo] ?? 0,
      asignado: asignados[tipo] ?? 0
    }));
  }

  isBadgeCompleto(asignado: number, requerido: number): boolean {
    return requerido > 0 && asignado >= requerido;
  }

  getBadgeMapa(label: string, asignado: number, requerido: number): Record<string, string> | undefined {
    if (!this.isBadgeCompleto(asignado, requerido)) return undefined;
    return { [label]: 'success' };
  }

  getTotalRequeridoPersonal(diaId: number): number {
    return (this.detalle?.requerimientosPersonalDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce((sum, r) => sum + this.toSafeNumber(r.cantidad), 0);
  }

  getTotalRequeridoEquipos(diaId: number): number {
    return (this.detalle?.requerimientosEquipoDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce((sum, r) => sum + this.toSafeNumber(r.cantidad), 0);
  }

  getTotalAsignadoPersonal(): number {
    return this.asignacionEmpleados.length;
  }

  getTotalAsignadoEquipos(): number {
    return this.asignacionEquipos.length;
  }

  getProgresoPersonalLabel(diaId: number): string {
    const total = this.getTotalRequeridoPersonal(diaId);
    const asignado = this.getTotalAsignadoPersonal();
    return `${Math.min(asignado, total)}/${total} completado`;
  }

  getProgresoEquiposLabel(diaId: number): string {
    const total = this.getTotalRequeridoEquipos(diaId);
    const asignado = this.getTotalAsignadoEquipos();
    return `${Math.min(asignado, total)}/${total} completado`;
  }

  highlightMatch(text: string, query: string): string {
    const safeText = String(text ?? '');
    const safeQuery = String(query ?? '').trim();
    if (!safeQuery) return safeText;
    const escaped = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'ig');
    return safeText.replace(re, match => `<span class="select-highlight">${match}</span>`);
  }

  private isRolRequerido(rol: string | null | undefined): boolean {
    if (!this.asignacionDiaId) return false;
    const key = (rol ?? '').toString().trim().toLowerCase();
    return (this.detalle?.requerimientosPersonalDia ?? [])
      .some(r => r.diaId === this.asignacionDiaId && (r.rol ?? '').toString().trim().toLowerCase() === key);
  }

  private isTipoRequerido(tipo: string | null | undefined): boolean {
    if (!this.asignacionDiaId) return false;
    const key = (tipo ?? '').toString().trim().toLowerCase();
    return (this.detalle?.requerimientosEquipoDia ?? [])
      .some(r => r.diaId === this.asignacionDiaId && (r.tipoEquipoNombre ?? '').toString().trim().toLowerCase() === key);
  }

  hasRequerimientosDia(diaId: number | null): boolean {
    if (!diaId) return false;
    return this.getTotalRequeridoPersonal(diaId) + this.getTotalRequeridoEquipos(diaId) > 0;
  }

  private marcarDrop(responsableId: number | null): void {
    this.ultimoDropDestino = responsableId ?? 'reserva';
    if (this.dropHighlightTimer) {
      window.clearTimeout(this.dropHighlightTimer);
    }
    this.dropHighlightTimer = window.setTimeout(() => {
      this.ultimoDropDestino = null;
    }, 1200);
  }

  puedeAgregarEmpleado(empleadoId: number | null): boolean {
    if (!empleadoId || !this.asignacionDiaId) return false;
    const emp = this.disponiblesEmpleados.find(e => e.empleadoId === empleadoId);
    const rol = emp?.cargo ? emp.cargo.toString().trim() : 'Sin rol';
    const requeridos = (this.detalle?.requerimientosPersonalDia ?? [])
      .filter(r => r.diaId === this.asignacionDiaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.rol ?? '').toString().trim() || 'Sin rol';
        acc[key] = (acc[key] ?? 0) + this.toSafeNumber(r.cantidad);
        return acc;
      }, {});
    const max = requeridos[rol];
    if (max === undefined) return false;
    const actual = this.asignacionEmpleados.reduce((sum, item) => {
      const e = this.disponiblesEmpleados.find(x => x.empleadoId === item.empleadoId);
      const key = e?.cargo ? e.cargo.toString().trim() : 'Sin rol';
      return sum + (key === rol ? 1 : 0);
    }, 0);
    return actual < max;
  }

  puedeAgregarEquipo(equipoId: number | null): boolean {
    if (!equipoId || !this.asignacionDiaId) return false;
    const eq = this.disponiblesEquipos.find(e => e.equipoId === equipoId);
    const tipo = eq?.nombreTipoEquipo ? eq.nombreTipoEquipo.toString().trim() : 'Sin tipo';
    const requeridos = (this.detalle?.requerimientosEquipoDia ?? [])
      .filter(r => r.diaId === this.asignacionDiaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.tipoEquipoNombre ?? '').toString().trim() || 'Sin tipo';
        acc[key] = (acc[key] ?? 0) + this.toSafeNumber(r.cantidad);
        return acc;
      }, {});
    const max = requeridos[tipo];
    if (max === undefined) return false;
    const actual = this.asignacionEquipos.reduce((sum, item) => {
      const e = this.disponiblesEquipos.find(x => x.equipoId === item.equipoId);
      const key = e?.nombreTipoEquipo ? e.nombreTipoEquipo.toString().trim() : 'Sin tipo';
      return sum + (key === tipo ? 1 : 0);
    }, 0);
    return actual < max;
  }

  private limitarEmpleadosPorRequerimiento(
    empleados: ProyectoAsignacionEmpleadoPayload[],
    diaId: number
  ): ProyectoAsignacionEmpleadoPayload[] {
    const requeridos = (this.detalle?.requerimientosPersonalDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.rol ?? '').toString().trim() || 'Sin rol';
        acc[key] = (acc[key] ?? 0) + this.toSafeNumber(r.cantidad);
        return acc;
      }, {});
    const conteo: Record<string, number> = {};
    const resultado: ProyectoAsignacionEmpleadoPayload[] = [];
    for (const item of empleados) {
      const emp = this.disponiblesEmpleados.find(e => e.empleadoId === item.empleadoId);
      const rol = emp?.cargo ? emp.cargo.toString().trim() : 'Sin rol';
      const max = requeridos[rol];
      if (max === undefined) continue;
      const actual = conteo[rol] ?? 0;
      if (actual >= max) continue;
      conteo[rol] = actual + 1;
      resultado.push({ empleadoId: item.empleadoId });
    }
    return resultado;
  }

  private limitarEquiposPorRequerimiento(
    equipos: ProyectoAsignacionEquipoPayload[],
    diaId: number
  ): ProyectoAsignacionEquipoPayload[] {
    const requeridos = (this.detalle?.requerimientosEquipoDia ?? [])
      .filter(r => r.diaId === diaId)
      .reduce<Record<string, number>>((acc, r) => {
        const key = (r.tipoEquipoNombre ?? '').toString().trim() || 'Sin tipo';
        acc[key] = (acc[key] ?? 0) + this.toSafeNumber(r.cantidad);
        return acc;
      }, {});
    const conteo: Record<string, number> = {};
    const resultado: ProyectoAsignacionEquipoPayload[] = [];
    for (const item of equipos) {
      const eq = this.disponiblesEquipos.find(e => e.equipoId === item.equipoId);
      const tipo = eq?.nombreTipoEquipo ? eq.nombreTipoEquipo.toString().trim() : 'Sin tipo';
      const max = requeridos[tipo];
      if (max === undefined) continue;
      const actual = conteo[tipo] ?? 0;
      if (actual >= max) continue;
      conteo[tipo] = actual + 1;
      resultado.push({ equipoId: item.equipoId, responsableId: item.responsableId ?? null });
    }
    return resultado;
  }

  private cargarDisponibles(fecha: string): void {
    if (!this.proyecto?.proyectoId) return;
    this.cargandoDisponibles = true;
    this.proyectoService.getAsignacionesDisponibles({
      fecha,
      proyectoId: this.proyecto.proyectoId
    })
      .pipe(finalize(() => { this.cargandoDisponibles = false; }))
      .subscribe({
        next: (data) => {
          this.disponiblesEmpleados = Array.isArray(data?.empleados) ? data.empleados : [];
          this.disponiblesEquipos = Array.isArray(data?.equipos) ? data.equipos : [];
        },
        error: (err) => {
          console.error('[proyecto] disponibles', err);
          this.disponiblesEmpleados = [];
          this.disponiblesEquipos = [];
        }
      });
  }

  onIncidenciaDiaChange(diaId: number | null): void {
    this.incidenciaDiaId = diaId;
    this.incidenciaEmpleadoId = null;
    this.incidenciaEmpleadoReemplazoId = null;
    this.incidenciaEquipoId = null;
    this.incidenciaEquipoReemplazoId = null;
    const fecha = this.detalle?.dias?.find(d => d.diaId === diaId)?.fecha ?? null;
    this.cargarDisponiblesIncidencia(fecha ?? null);
  }

  onIncidenciaEmpleadoChange(empleadoId: number | null): void {
    this.incidenciaEmpleadoId = empleadoId;
    this.incidenciaEmpleadoReemplazoId = null;
  }

  onIncidenciaEquipoChange(equipoId: number | null): void {
    this.incidenciaEquipoId = equipoId;
    this.incidenciaEquipoReemplazoId = null;
  }

  private cargarDisponiblesIncidencia(diaIdOrFecha: number | string | null): void {
    if (!this.proyecto?.proyectoId) return;
    const fecha = typeof diaIdOrFecha === 'number'
      ? this.detalle?.dias?.find(d => d.diaId === diaIdOrFecha)?.fecha ?? null
      : diaIdOrFecha;
    if (!fecha) {
      this.disponiblesIncidenciaEmpleados = [];
      this.disponiblesIncidenciaEquipos = [];
      return;
    }
    this.cargandoDisponiblesIncidencia = true;
    this.proyectoService.getAsignacionesDisponibles({
      fecha,
      proyectoId: this.proyecto.proyectoId
    })
      .pipe(finalize(() => { this.cargandoDisponiblesIncidencia = false; }))
      .subscribe({
        next: data => {
          this.disponiblesIncidenciaEmpleados = Array.isArray(data?.empleados) ? data.empleados : [];
          this.disponiblesIncidenciaEquipos = Array.isArray(data?.equipos) ? data.equipos : [];
        },
        error: err => {
          console.error('[proyecto] disponibles incidencia', err);
          this.disponiblesIncidenciaEmpleados = [];
          this.disponiblesIncidenciaEquipos = [];
        }
      });
  }

  abrirModalDevolucion(diaId?: number): void {
    const selected = diaId ?? this.openDiaId ?? this.detalle?.dias?.[0]?.diaId ?? null;
    if (!selected) return;
    this.devolucionDiaId = selected;
    this.modalDevolucionAbierto = true;
    this.cargarDevolucionDraft(selected);
  }

  cerrarModalDevolucion(): void {
    this.modalDevolucionAbierto = false;
    this.devolucionDiaId = null;
    this.devolucionDraft = {};
  }

  private cargarDevolucionDraft(diaId: number): void {
    const equipos = (this.detalle?.equiposDia ?? []).filter(item => item.diaId === diaId);
    const draft: Record<number, { estado: ProyectoEstadoDevolucion | ''; notas: string; fecha: string | null }> = {};
    equipos.forEach(eq => {
      draft[eq.equipoId] = {
        estado: (eq.estadoDevolucion as ProyectoEstadoDevolucion) ?? '',
        notas: eq.notasDevolucion ?? '',
        fecha: eq.fechaDevolucion || null
      };
    });
    this.devolucionDraft = draft;
  }

  onDevolucionEstadoChange(equipoId: number, estado: ProyectoEstadoDevolucion | ''): void {
    const current = this.devolucionDraft[equipoId] || { estado: '', notas: '', fecha: null };
    this.devolucionDraft[equipoId] = { ...current, estado };
  }

  onDevolucionNotasChange(equipoId: number, notas: string): void {
    const current = this.devolucionDraft[equipoId] || { estado: '', notas: '', fecha: null };
    this.devolucionDraft[equipoId] = { ...current, notas };
  }

  onDevolucionFechaChange(equipoId: number, fecha: string): void {
    const current = this.devolucionDraft[equipoId] || { estado: '', notas: '', fecha: null };
    this.devolucionDraft[equipoId] = { ...current, fecha: fecha || null };
  }

  getEquiposDevolucionDia(diaId: number | null): typeof this.detalle.equiposDia {
    if (!diaId) return [];
    return (this.detalle?.equiposDia ?? []).filter(item => item.diaId === diaId);
  }

  private isDevolucionChanged(eq: { equipoId: number; estadoDevolucion: string; notasDevolucion: string; fechaDevolucion: string }): boolean {
    const draft = this.devolucionDraft[eq.equipoId];
    if (!draft) return false;
    const estadoOrig = (eq.estadoDevolucion ?? '').toString();
    const notasOrig = eq.notasDevolucion ?? '';
    const fechaOrig = eq.fechaDevolucion ?? null;
    return (
      (draft.estado ?? '') !== estadoOrig ||
      (draft.notas ?? '') !== notasOrig ||
      (draft.fecha ?? null) !== fechaOrig
    );
  }

  private buildDevolucionPayload(): ProyectoDevolucionEquiposPayload {
    const equipos = this.getEquiposDevolucionDia(this.devolucionDiaId)
      .filter(eq => this.isDevolucionChanged(eq))
      .map(eq => {
        const draft = this.devolucionDraft[eq.equipoId];
        const estado = draft?.estado ?? '';
        const devuelto: 0 | 1 = estado === 'DEVUELTO' || estado === 'DANADO' ? 1 : 0;
        const item: ProyectoDevolucionEquipoItem = {
          equipoId: eq.equipoId,
          devuelto,
          estadoDevolucion: estado || null,
          notasDevolucion: draft?.notas ?? ''
        };
        if (draft?.fecha) {
          item.fechaDevolucion = draft.fecha;
        }
        return item;
      });

    return {
      equipos
    };
  }

  canGuardarDevoluciones(): boolean {
    if (!this.devolucionDiaId) return false;
    const equipos = this.getEquiposDevolucionDia(this.devolucionDiaId);
    const cambios = equipos.filter(eq => this.isDevolucionChanged(eq));
    if (!cambios.length) return false;
    const validEstados: ProyectoEstadoDevolucion[] = ['DEVUELTO', 'DANADO', 'PERDIDO', 'ROBADO'];
    return cambios.every(eq => {
      const draft = this.devolucionDraft[eq.equipoId];
      if (!draft?.estado) return false;
      return validEstados.includes(draft.estado);
    });
  }

  guardarDevoluciones(): void {
    if (!this.devolucionDiaId || !this.canGuardarDevoluciones()) return;
    const payload = this.buildDevolucionPayload();
    if (!payload.equipos.length) return;
    this.guardandoDevolucion = true;
    this.proyectoService.registrarDevolucionesDia(this.devolucionDiaId, payload)
      .pipe(finalize(() => { this.guardandoDevolucion = false; }))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Devoluciones registradas',
            timer: 1400,
            showConfirmButton: false
          });
          if (!this.proyecto?.proyectoId) return;
          this.proyectoService.getProyecto(this.proyecto.proyectoId)
            .subscribe({
              next: data => {
                this.detalle = data;
                this.proyecto = data?.proyecto ?? null;
                this.rebuildDiaCaches();
                this.cargarDevolucionDraft(this.devolucionDiaId!);
              },
              error: err => {
                console.error('[proyecto] devolucion refresh', err);
              }
            });
        },
        error: err => {
          console.error('[proyecto] devoluciones', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo registrar',
            text: 'Revisa los datos e intenta nuevamente.'
          });
        }
      });
  }

  private getEmpleadoRolEnDia(empleadoId: number | null, diaId: number | null): string | null {
    if (!empleadoId || !diaId) return null;
    const empleado = (this.detalle?.empleadosDia ?? [])
      .find(item => item.diaId === diaId && item.empleadoId === empleadoId);
    if (!empleado) return null;
    if (empleado.cargoId !== undefined && empleado.cargoId !== null) {
      return `id:${empleado.cargoId}`;
    }
    const rol = (empleado.rol ?? empleado.cargo ?? '').toString().trim();
    return rol ? rol.toLowerCase() : null;
  }

  getReemplazoEmpleadoOptions(): { empleadoId: number; empleadoNombre: string }[] {
    const rolNorm = this.getEmpleadoRolEnDia(this.incidenciaEmpleadoId, this.incidenciaDiaId);
    const asignadosDia = new Set(
      (this.detalle?.empleadosDia ?? [])
        .filter(item => item.diaId === this.incidenciaDiaId)
        .map(item => item.empleadoId)
    );
    return this.disponiblesIncidenciaEmpleados
      .filter(emp => emp.empleadoId !== this.incidenciaEmpleadoId)
      .filter(emp => !asignadosDia.has(emp.empleadoId)) // solo libres (no ya asignados al día)
      .filter(emp => {
        if (!rolNorm) return true;
        const key = emp.cargoId !== undefined && emp.cargoId !== null
          ? `id:${emp.cargoId}`
          : (emp.cargo ?? '').toString().trim().toLowerCase();
        return key === rolNorm;
      })
      .map(emp => ({
        empleadoId: emp.empleadoId,
        empleadoNombre: `${emp.nombre} ${emp.apellido}`.trim() || `Empleado #${emp.empleadoId}`
      }));
  }

  getReemplazoEquipoOptions(): { equipoId: number; label: string }[] {
    if (!this.incidenciaDiaId) return [];
    const affected = (this.detalle?.equiposDia ?? [])
      .find(item => item.diaId === this.incidenciaDiaId && item.equipoId === this.incidenciaEquipoId);
    const affectedTipo = affected?.tipoEquipo ? affected.tipoEquipo.toString().trim().toLowerCase() : null;

    const reservaDia = (this.detalle?.equiposDia ?? [])
      .filter(item => item.diaId === this.incidenciaDiaId && (!item.responsableId || item.responsableId === null));

    return reservaDia
      .filter(eq => eq.equipoId !== this.incidenciaEquipoId)
      .filter(eq => !affectedTipo || (eq.tipoEquipo ?? '').toString().trim().toLowerCase() === affectedTipo)
      .map(eq => ({
        equipoId: eq.equipoId,
        label: `${eq.modelo || 'Equipo'} (${eq.equipoSerie || '—'})`
      }));
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
    return this.serviciosDiaMap.get(diaId) ?? [];
  }

  getBloquesDia(diaId: number): BloqueDia[] {
    return this.bloquesDiaMap.get(diaId) ?? [];
  }

  getBloquesCount(diaId: number): number {
    return this.getDiaResumen(diaId).bloquesCount;
  }

  getRangoHorasDia(diaId: number): { inicio: string; fin: string } | null {
    return this.getDiaResumen(diaId).rangoHoras;
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
    const dias = [...this.diasOrdenadosCache];
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
    const resumen = this.getDiaResumen(diaId);
    return {
      personal: resumen.pendientesPersonal,
      equipos: resumen.pendientesEquipos
    };
  }

  getServiciosCountDia(diaId: number): number {
    return this.getDiaResumen(diaId).serviciosCount;
  }

  getReqPersonalCountDia(diaId: number): number {
    return this.getDiaResumen(diaId).reqPersonal;
  }

  getReqEquiposCountDia(diaId: number): number {
    return this.getDiaResumen(diaId).reqEquipos;
  }

  getAsignadosPersonalDia(diaId: number): number {
    return this.getDiaResumen(diaId).asignPersonal;
  }

  getAsignadosEquiposDia(diaId: number): number {
    return this.getDiaResumen(diaId).asignEquipos;
  }

  getEstadoAsignacionDia(diaId: number): EstadoAsignacionDia {
    return this.getDiaResumen(diaId).estadoAsignacion;
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
    const dias = [...this.diasOrdenadosCache];
    if (!this.soloPendientes) return dias;
    return dias.filter(d => (d.estadoDiaNombre ?? '').toString().trim().toLowerCase() === 'pendiente');
  }

  private updateStepperOrientation(): void {
    if (typeof window === 'undefined') return;
    this.stepperOrientation = window.innerWidth < 900 ? 'vertical' : 'horizontal';
  }

  private getDiaResumen(diaId: number): DiaResumen {
    return this.diaResumenMap.get(diaId) ?? {
      bloquesCount: 0,
      serviciosCount: 0,
      reqPersonal: 0,
      reqEquipos: 0,
      asignPersonal: 0,
      asignEquipos: 0,
      pendientesPersonal: 0,
      pendientesEquipos: 0,
      estadoAsignacion: '—',
      rangoHoras: null,
      incidenciasCount: 0
    };
  }

  private rebuildDiaCaches(): void {
    const detalle = this.detalle;
    this.diasOrdenadosCache = [...(detalle?.dias ?? [])]
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    this.bloquesDiaMap.clear();
    this.serviciosDiaMap.clear();
    this.incidenciasDiaMap.clear();
    this.diaResumenMap.clear();
    if (!detalle) return;

    const reqPersonalPorDia = new Map<number, number>();
    (detalle.requerimientosPersonalDia ?? []).forEach(row => {
      reqPersonalPorDia.set(row.diaId, (reqPersonalPorDia.get(row.diaId) ?? 0) + this.toSafeNumber(row.cantidad));
    });

    const reqEquiposPorDia = new Map<number, number>();
    (detalle.requerimientosEquipoDia ?? []).forEach(row => {
      reqEquiposPorDia.set(row.diaId, (reqEquiposPorDia.get(row.diaId) ?? 0) + this.toSafeNumber(row.cantidad));
    });

    const asignPersonalPorDia = new Map<number, number>();
    (detalle.empleadosDia ?? []).forEach(row => {
      asignPersonalPorDia.set(row.diaId, (asignPersonalPorDia.get(row.diaId) ?? 0) + 1);
    });

    const asignEquiposPorDia = new Map<number, number>();
    (detalle.equiposDia ?? []).forEach(row => {
      asignEquiposPorDia.set(row.diaId, (asignEquiposPorDia.get(row.diaId) ?? 0) + 1);
    });

    (detalle.bloquesDia ?? []).forEach(row => this.pushMapItem(this.bloquesDiaMap, row.diaId, row));
    this.bloquesDiaMap.forEach((rows, diaId) => {
      this.bloquesDiaMap.set(diaId, [...rows].sort((a, b) => this.toSafeNumber(a.orden) - this.toSafeNumber(b.orden)));
    });

    (detalle.serviciosDia ?? []).forEach(row => this.pushMapItem(this.serviciosDiaMap, row.diaId, row));

    (detalle.incidenciasDia ?? []).forEach((row: IncidenciaDia) => {
      this.pushMapItem(this.incidenciasDiaMap, row.diaId, {
        incidenciaId: row.incidenciaId,
        tipo: row.tipo,
        descripcion: row.descripcion,
        createdAt: row.createdAt,
        empleadoNombre: row.empleadoNombre ?? null,
        empleadoCargo: row.empleadoCargo ?? null,
        empleadoReemplazoNombre: row.empleadoReemplazoNombre ?? null,
        empleadoReemplazoCargo: row.empleadoReemplazoCargo ?? null
      });
    });

    this.diasOrdenadosCache.forEach(dia => {
      const diaId = dia.diaId;
      const reqPersonal = reqPersonalPorDia.get(diaId) ?? 0;
      const reqEquipos = reqEquiposPorDia.get(diaId) ?? 0;
      const asignPersonal = asignPersonalPorDia.get(diaId) ?? 0;
      const asignEquipos = asignEquiposPorDia.get(diaId) ?? 0;
      const pendientesPersonal = Math.max(reqPersonal - asignPersonal, 0);
      const pendientesEquipos = Math.max(reqEquipos - asignEquipos, 0);
      const totalReq = reqPersonal + reqEquipos;
      const totalAsign = asignPersonal + asignEquipos;

      let estadoAsignacion: EstadoAsignacionDia = '—';
      if (totalReq > 0) {
        if (totalAsign === 0) {
          estadoAsignacion = 'Sin asignar';
        } else if (pendientesPersonal > 0 || pendientesEquipos > 0) {
          estadoAsignacion = 'Pendiente';
        } else {
          estadoAsignacion = 'Completo';
        }
      }

      this.diaResumenMap.set(diaId, {
        bloquesCount: (this.bloquesDiaMap.get(diaId) ?? []).length,
        serviciosCount: (this.serviciosDiaMap.get(diaId) ?? []).length,
        reqPersonal,
        reqEquipos,
        asignPersonal,
        asignEquipos,
        pendientesPersonal,
        pendientesEquipos,
        estadoAsignacion,
        rangoHoras: this.computeRangoHorasDia(diaId),
        incidenciasCount: (this.incidenciasDiaMap.get(diaId) ?? []).length
      });
    });
  }

  private computeRangoHorasDia(diaId: number): { inicio: string; fin: string } | null {
    const bloques = this.bloquesDiaMap.get(diaId) ?? [];
    if (!bloques.length) return null;
    const tiempos = bloques
      .map(b => this.toMinutes(b.hora))
      .filter((n): n is number => n !== null);
    if (!tiempos.length) return null;
    const min = Math.min(...tiempos);
    const max = Math.max(...tiempos);
    return {
      inicio: this.formatHora12(this.fromMinutes(min)),
      fin: this.formatHora12(this.fromMinutes(max))
    };
  }

  private pushMapItem<T>(map: Map<number, T[]>, key: number, value: T): void {
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(value);
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


}
