import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, Subject, takeUntil } from 'rxjs';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';

import { ProyectoDetalle } from '../model/proyecto.model';
import { ProyectoService } from '../service/proyecto.service';
import { PersonalService, EmpleadoOperativo, Cargo } from '../../gestionar-personal/service/personal.service';
import { AdministrarEquiposService } from '../../administrar-equipos/service/administrar-equipos.service';
import { EquipoInventario } from '../../administrar-equipos/models/equipo-inventario.model';
import { TipoEquipo } from '../../administrar-equipos/models/tipo-equipo.model';
import { PedidoRequerimientos } from '../model/detalle-proyecto.model';

@Component({
  selector: 'app-detalle-proyecto',
  templateUrl: './detalle-proyecto.component.html',
  styleUrls: ['./detalle-proyecto.component.css']
})
export class DetalleProyectoComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;
  proyecto: ProyectoDetalle | null = null;
  requerimientos: PedidoRequerimientos | null = null;

  formAsignacion: UntypedFormGroup = this.fb.group({
    empleadoId: [null, Validators.required],
    equipoId: [null, Validators.required]
  });

  disponiblesPersonal: EmpleadoOperativo[] = [];
  equiposDisponibles: EquipoInventario[] = [];
  asignacionesPendientes: Array<{ empleadoId: number; equipoIds: number[] }> = [];
  modalAsignarAbierto = false;
  filtroRol: string | null = null;
  filtroTipoEquipoId: number | null = null;
  seleccionados: number[] = [];
  asignacionEquipos: Record<number, number[]> = {};
  selectedEquipos: number[] = [];
  stepIndex = 0;
  rolesOperativos: string[] = [];
  tiposEquipo: TipoEquipo[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly proyectoService: ProyectoService,
    private readonly personalService: PersonalService,
    private readonly equiposService: AdministrarEquiposService,
    private readonly fb: UntypedFormBuilder
  ) { }

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
          this.proyecto = data;
          this.loadDisponiblesPersonal(data.proyectoId);
          this.loadEquipos();
          this.loadRequerimientos(data.pedidoId);
          this.loadRolesOperativos();
          this.loadTiposEquipos();
        },
        error: (err) => {
          console.error('[proyecto] detalle', err);
          this.error = 'No pudimos cargar el proyecto.';
        }
      });
  }

  abrirModalAsignar(): void {
    this.modalAsignarAbierto = true;
    this.seleccionados = [];
    this.asignacionEquipos = {};
    this.filtroRol = null;
    this.filtroTipoEquipoId = null;
    this.selectedEquipos = [];
    this.stepIndex = 0;
  }

  cerrarModalAsignar(): void {
    this.modalAsignarAbierto = false;
  }

  toggleSeleccionEmpleado(idEmpleado: number): void {
    if (this.seleccionados.includes(idEmpleado)) {
      this.seleccionados = this.seleccionados.filter(id => id !== idEmpleado);
      delete this.asignacionEquipos[idEmpleado];
      return;
    }
    this.seleccionados = [...this.seleccionados, idEmpleado];
    this.asignacionEquipos[idEmpleado] = [];
  }

  toggleSeleccionEquipo(idEquipo: number): void {
    if (this.selectedEquipos.includes(idEquipo)) {
      this.selectedEquipos = this.selectedEquipos.filter(id => id !== idEquipo);
      this.clearAsignacionesParaEquipo(idEquipo);
      return;
    }
    this.selectedEquipos = [...this.selectedEquipos, idEquipo];
  }

  setEquiposParaEmpleado(idEmpleado: number, equipos: number[]): void {
    this.asignacionEquipos = { ...this.asignacionEquipos, [idEmpleado]: equipos || [] };
  }

  guardarAsignacionesEnModal(): void {
    const asignaciones = this.seleccionados
      .map(idEmpleado => ({
        empleadoId: idEmpleado,
        equipoIds: this.asignacionEquipos[idEmpleado] ?? []
      }))
      .filter(p => p.equipoIds.length);
    if (!asignaciones.length) return;
    this.asignacionesPendientes = asignaciones;
    this.cerrarModalAsignar();
  }

  getPersonalFiltrado(): EmpleadoOperativo[] {
    if (!this.filtroRol) return this.disponiblesPersonal;
    return this.disponiblesPersonal.filter(p =>
      p.cargo?.toLowerCase().includes(this.filtroRol.toLowerCase())
    );
  }

  getCupoRol(rol: string | null): number | null {
    if (!rol || !this.requerimientos?.totales?.personal?.length) return null;
    const found = this.requerimientos.totales.personal.find(
      req => req.rol?.toLowerCase() === rol.toLowerCase()
    );
    return found ? found.cantidad : 0;
  }

  getSeleccionadosPorRol(rol: string | null): number {
    if (!rol) return this.seleccionados.length;
    return this.seleccionados
      .map(id => this.disponiblesPersonal.find(per => per.empleadoId === id))
      .filter(per => per && per.cargo?.toLowerCase() === rol.toLowerCase()).length;
  }

  isEmpleadoDisabled(p: EmpleadoOperativo): boolean {
    const rolObjetivo = this.filtroRol ?? p.cargo;
    const cupo = this.getCupoRol(rolObjetivo);
    if (cupo === null) return false;
    const selectedForRol = this.getSeleccionadosPorRol(rolObjetivo);
    const excedido = cupo === 0 || selectedForRol >= cupo;
    return excedido && !this.seleccionados.includes(p.empleadoId);
  }

  quitarSeleccion(idEmpleado: number): void {
    this.seleccionados = this.seleccionados.filter(id => id !== idEmpleado);
    delete this.asignacionEquipos[idEmpleado];
  }

  getEquipoCupo(tipoEquipoId: number | null): number | null {
    if (!tipoEquipoId || !this.requerimientos?.totales?.equipos?.length) return null;
    const found = this.requerimientos.totales.equipos.find(req => req.tipoEquipoId === tipoEquipoId);
    return found ? found.cantidad : 0;
  }

  isEquipoDisabled(e: EquipoInventario): boolean {
    const cupo = this.getEquipoCupo(e.idTipoEquipo);
    if (!cupo) return false;
    const seleccionadosTipo = this.selectedEquipos
      .map(id => this.equiposDisponibles.find(eq => eq.idEquipo === id))
      .filter(eq => eq && eq.idTipoEquipo === e.idTipoEquipo).length;
    return seleccionadosTipo >= cupo && !this.selectedEquipos.includes(e.idEquipo);
  }

  getSeleccionadosEquipoPorTipo(tipoEquipoId: number | null): number {
    if (!tipoEquipoId) return this.selectedEquipos.length;
    return this.selectedEquipos
      .map(id => this.equiposDisponibles.find(eq => eq.idEquipo === id))
      .filter(eq => eq && eq.idTipoEquipo === tipoEquipoId).length;
  }

  avanzarPaso(): void {
    if (this.stepIndex === 0 && !this.seleccionados.length) return;
    if (this.stepIndex === 1 && !this.selectedEquipos.length) return;
    this.stepIndex = Math.min(2, this.stepIndex + 1);
  }

  retrocederPaso(): void {
    this.stepIndex = Math.max(0, this.stepIndex - 1);
  }

  getEquiposSeleccionados(): EquipoInventario[] {
    return this.equiposDisponibles.filter(e => this.selectedEquipos.includes(e.idEquipo));
  }

  getEquiposFiltrados(): EquipoInventario[] {
    if (!this.filtroTipoEquipoId) return this.equiposDisponibles;
    return this.equiposDisponibles.filter(e => e.idTipoEquipo === this.filtroTipoEquipoId);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDisponiblesPersonal(_: number): void {
    this.personalService.getOperativos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: lista => { this.disponiblesPersonal = Array.isArray(lista) ? lista : []; },
        error: err => {
          console.error('[personal] listar', err);
          this.disponiblesPersonal = [];
        }
      });
  }

  private loadEquipos(): void {
    this.equiposService.getEquipos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: lista => { this.equiposDisponibles = Array.isArray(lista) ? lista : []; },
        error: err => {
          console.error('[equipos] inventario', err);
          this.equiposDisponibles = [];
        }
      });
  }

  private loadRequerimientos(pedidoId: number): void {
    this.proyectoService.getPedidoRequerimientos(pedidoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => { this.requerimientos = data; },
        error: err => {
          console.error('[pedido] requerimientos', err);
          this.requerimientos = null;
        }
      });
  }

  private loadRolesOperativos(): void {
    this.personalService.getCargos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cargos: Cargo[]) => {
          this.rolesOperativos = (cargos ?? [])
            .filter(c => c.esOperativoCampo === 1)
            .map(c => c.cargoNombre);
        },
        error: err => {
          console.error('[cargos] operativos', err);
          this.rolesOperativos = [];
        }
      });
  }

  private loadTiposEquipos(): void {
    this.equiposService.obtenerTipos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tipos) => { this.tiposEquipo = tipos ?? []; },
        error: (err) => {
          console.error('[equipos] tipos', err);
          this.tiposEquipo = [];
        }
      });
  }

  getNombreEmpleado(id: number | null): string {
    if (!id) return '';
    const found = this.disponiblesPersonal.find(p => p.empleadoId === id);
    return found ? `${found.nombre} ${found.apellido}` : '';
  }

  getEquipoLabel(id: number | null): string {
    if (!id) return '';
    const found = this.equiposDisponibles.find(e => e.idEquipo === id);
    return found ? `${found.nombreModelo} (${found.serie})` : '';
  }

  getTipoEquipoNombre(id: number | null): string {
    if (!id) return '';
    const found = this.equiposDisponibles.find(e => e.idEquipo === id);
    return found?.nombreTipoEquipo || '';
  }

  faltanAsignaciones(): boolean {
    if (!this.seleccionados.length) return true;
    const equiposAsignados = this.seleccionados.filter(id => (this.asignacionEquipos[id] ?? []).length > 0);
    return equiposAsignados.length !== this.seleccionados.length;
  }

  getCargoEmpleado(id: number | null): string {
    if (!id) return '';
    const found = this.disponiblesPersonal.find(p => p.empleadoId === id);
    return found?.cargo || '';
  }

  private clearAsignacionesParaEquipo(idEquipo: number): void {
    Object.keys(this.asignacionEquipos).forEach(key => {
      const numKey = Number(key);
      this.asignacionEquipos[numKey] = (this.asignacionEquipos[numKey] ?? []).filter(eqId => eqId !== idEquipo);
    });
  }
}
