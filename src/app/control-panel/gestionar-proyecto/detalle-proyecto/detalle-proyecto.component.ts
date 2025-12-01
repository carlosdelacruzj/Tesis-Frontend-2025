import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, Subject, takeUntil } from 'rxjs';
import { UntypedFormArray, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import Swal from 'sweetalert2';

import { ProyectoDetalle, ProyectoRecurso } from '../model/proyecto.model';
import { ProyectoService } from '../service/proyecto.service';
import { PersonalService, Cargo } from '../../gestionar-personal/service/personal.service';
import { AdministrarEquiposService } from '../../administrar-equipos/service/administrar-equipos.service';
import { TipoEquipo } from '../../administrar-equipos/models/tipo-equipo.model';
import { PedidoRequerimientos } from '../model/detalle-proyecto.model';
import { VisualizarService } from '../../gestionar-pedido/service/visualizar.service';
import { DisponibilidadEmpleado, DisponibilidadEquipo } from '../model/proyecto-disponibilidad.model';

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
  pedidoDetalle: any = null;
  estados: Array<{ estadoId: number; estadoNombre: string }> = [];
  guardandoDevoluciones = false;
  guardandoProyecto = false;
  devolucionesRegistradas = false;

  formAsignacion: UntypedFormGroup = this.fb.group({
    empleadoId: [null, Validators.required],
    equipoId: [null, Validators.required]
  });

  proyectoForm: UntypedFormGroup = this.fb.group({
    proyectoNombre: ['', Validators.required],
    fechaInicioEdicion: [''],
    fechaFinEdicion: [''],
    estadoId: [null, Validators.required],
    responsableId: [null],
    notas: [''],
    enlace: [''],
    multimedia: [null],
    edicion: [null]
  });

  devolucionForm: UntypedFormGroup = this.fb.group({
    devoluciones: this.fb.array([])
  });

  readonly estadosDevolucion = [
    { value: 'devuelto', label: 'Devuelto' },
    { value: 'daniado', label: 'Dañado' },
    { value: 'faltante', label: 'Faltante' }
  ];

  disponiblesPersonal: DisponibilidadEmpleado[] = [];
  equiposDisponibles: DisponibilidadEquipo[] = [];
  asignacionesPendientes: Array<{
    empleadoId: number | null;
    equipoId: number;
    fechaInicio: string;
    fechaFin: string;
    notas: string;
  }> = [];
  modalAsignarAbierto = false;
  filtroRol: string | null = null;
  filtroTipoEquipoId: number | null = null;
  seleccionados: number[] = [];
  selectedEquipos: number[] = [];
  stepIndex = 0;
  rolesOperativos: string[] = [];
  tiposEquipo: TipoEquipo[] = [];
  tableroAsignacion: { reserva: number[]; empleados: Record<number, number[]> } = { reserva: [], empleados: {} };
  recursosColumns = [
    { key: 'empleadoNombre', header: 'Empleado', sortable: true },
    { key: 'modelo', header: 'Equipo', sortable: true },
    { key: 'equipoSerie', header: 'Serie', sortable: true },
    { key: 'tipoEquipo', header: 'Tipo', sortable: true }
  ];
  serviciosColumns = [
    { key: 'nombre', header: 'Título', sortable: true },
    { key: 'evento', header: 'Evento', sortable: true },
    { key: 'precio', header: 'Precio', sortable: true },
    { key: 'notas', header: 'Notas', sortable: false }
  ];
  eventosColumns = [
    { key: 'fecha', header: 'Fecha', sortable: true },
    { key: 'hora', header: 'Hora', sortable: true },
    { key: 'ubicacion', header: 'Locación', sortable: true },
    { key: 'direccion', header: 'Dirección', sortable: true },
    { key: 'notas', header: 'Notas', sortable: false }
  ];
  dropListIds: string[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly proyectoService: ProyectoService,
    private readonly personalService: PersonalService,
    private readonly equiposService: AdministrarEquiposService,
    private readonly visualizarService: VisualizarService,
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
          this.patchProyectoForm(data);
          this.buildDevolucionForm(data.recursos ?? []);
          this.devolucionesRegistradas = this.devolucionesCompletas(data.recursos ?? []);
          this.loadPedido(data.pedidoId);
          this.loadAsignaciones(data.proyectoId);
          this.loadRequerimientos(data.pedidoId);
          this.loadRolesOperativos();
          this.loadTiposEquipos();
          this.loadEstados();
        },
        error: (err) => {
          console.error('[proyecto] detalle', err);
          this.error = 'No pudimos cargar el proyecto.';
        }
      });
  }

  abrirModalAsignar(): void {
    if (!this.puedeAsignarRecursos()) {
      Swal.fire({
        icon: 'info',
        title: 'Asignación bloqueada',
        text: 'En estado Ejecución no se pueden agregar nuevas asignaciones.'
      });
      return;
    }
    this.modalAsignarAbierto = true;
    this.seleccionados = [];
    this.filtroRol = null;
    this.filtroTipoEquipoId = null;
    this.selectedEquipos = [];
    this.tableroAsignacion = { reserva: [], empleados: {} };
    this.dropListIds = [];
    this.asignacionesPendientes = [];
    this.stepIndex = 0;

    const recursos = this.proyecto?.recursos ?? [];
    if (recursos.length) {
      const empleadosMap: Record<number, number[]> = {};
      const empleadosSet = new Set<number>();
      const equiposSet = new Set<number>();
      const reserva: number[] = [];

      recursos.forEach(r => {
        equiposSet.add(r.equipoId);
        if (r.empleadoId) {
          empleadosSet.add(r.empleadoId);
          empleadosMap[r.empleadoId] = empleadosMap[r.empleadoId] || [];
          empleadosMap[r.empleadoId].push(r.equipoId);
        } else {
          reserva.push(r.equipoId);
        }
      });

      this.seleccionados = Array.from(empleadosSet);
      this.selectedEquipos = Array.from(equiposSet);
      const empleadosAsign = Array.from(empleadosSet).reduce<Record<number, number[]>>((acc, id) => {
        acc[id] = empleadosMap[id] ?? [];
        return acc;
      }, {});
      this.tableroAsignacion = { reserva, empleados: empleadosAsign };
      this.dropListIds = ['reserva', ...this.seleccionados.map(id => `emp-${id}`)];
    }
  }

  cerrarModalAsignar(): void {
    this.modalAsignarAbierto = false;
  }

  get devoluciones(): UntypedFormArray {
    return this.devolucionForm.get('devoluciones') as UntypedFormArray;
  }

  async toggleSeleccionEmpleado(idEmpleado: number): Promise<void> {
    if (this.seleccionados.includes(idEmpleado)) {
      const confirm = await Swal.fire({
        title: 'Quitar empleado',
        text: '¿Seguro que quieres quitar a este empleado de las asignaciones?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        cancelButtonText: 'Cancelar',
        allowOutsideClick: false,
        allowEscapeKey: false
      });
      if (!confirm.isConfirmed) return;

      this.seleccionados = this.seleccionados.filter(id => id !== idEmpleado);
      if (this.tableroAsignacion.empleados[idEmpleado]?.length) {
        this.tableroAsignacion.reserva.push(...this.tableroAsignacion.empleados[idEmpleado]);
      }
      delete this.tableroAsignacion.empleados[idEmpleado];
      this.dropListIds = ['reserva', ...this.seleccionados.map(id => `emp-${id}`)];
      return;
    }
    this.seleccionados = [...this.seleccionados, idEmpleado];
  }

  async toggleSeleccionEquipo(idEquipo: number): Promise<void> {
    if (this.selectedEquipos.includes(idEquipo)) {
      const confirm = await Swal.fire({
        title: 'Quitar equipo',
        text: '¿Seguro que quieres quitar este equipo de la asignación?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        cancelButtonText: 'Cancelar',
        allowOutsideClick: false,
        allowEscapeKey: false
      });
      if (!confirm.isConfirmed) return;

      this.selectedEquipos = this.selectedEquipos.filter(id => id !== idEquipo);
      this.quitarEquipoDeTablero(idEquipo);
      return;
    }
    this.selectedEquipos = [...this.selectedEquipos, idEquipo];
  }

  guardarAsignacionesEnModal(): void {
    if (!this.proyecto?.proyectoId) {
      return;
    }

    this.limpiarEquiposNoSeleccionados();

    const { inicio, fin } = this.getRangoPedido();
    const asignaciones: Array<{
      empleadoId: number | null;
      equipoId: number;
      fechaInicio: string;
      fechaFin: string;
      notas: string;
    }> = [];

    Object.entries(this.tableroAsignacion.empleados)
      .filter(([empleadoId]) => this.seleccionados.includes(Number(empleadoId)))
      .forEach(([empleadoId, lista]) => {
        lista.forEach(eqId => {
          if (!this.selectedEquipos.includes(eqId)) return;
          asignaciones.push({
            empleadoId: Number(empleadoId),
            equipoId: eqId,
            fechaInicio: inicio,
            fechaFin: fin,
            notas: ''
          });
        });
      });

    this.tableroAsignacion.reserva.forEach(eqId => {
      if (!this.selectedEquipos.includes(eqId)) return;
      asignaciones.push({
        empleadoId: null,
        equipoId: eqId,
        fechaInicio: inicio,
        fechaFin: fin,
        notas: 'Reserva'
      });
    });

    this.asignacionesPendientes = asignaciones;

    this.proyectoService.guardarRecursos({
      proyectoId: this.proyecto.proyectoId,
      asignaciones
    }).subscribe({
      next: () => {
        this.cerrarModalAsignar();
        this.loadAsignaciones(this.proyecto?.proyectoId ?? 0);
      },
      error: (err) => {
        console.error('[proyecto] guardar recursos', err);
      }
    });
  }

  getPersonalFiltrado(): DisponibilidadEmpleado[] {
    const base = this.disponiblesPersonal.filter(p => p.disponible);
    if (!this.filtroRol) return base;
    return base.filter(p =>
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

  isEmpleadoDisabled(p: DisponibilidadEmpleado): boolean {
    if (!p.disponible) return true;
    const rolObjetivo = this.filtroRol ?? p.cargo;
    const cupo = this.getCupoRol(rolObjetivo);
    if (cupo === null) return false;
    const selectedForRol = this.getSeleccionadosPorRol(rolObjetivo);
    const excedido = cupo === 0 || selectedForRol >= cupo;
    return excedido && !this.seleccionados.includes(p.empleadoId);
  }

  async quitarSeleccion(idEmpleado: number): Promise<void> {
    const confirm = await Swal.fire({
      title: 'Quitar empleado',
      text: '¿Seguro que quieres quitar a este empleado de las asignaciones?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, quitar',
      cancelButtonText: 'Cancelar',
      allowOutsideClick: false,
      allowEscapeKey: false
    });
    if (!confirm.isConfirmed) return;

    this.seleccionados = this.seleccionados.filter(id => id !== idEmpleado);
    if (this.tableroAsignacion.empleados[idEmpleado]?.length) {
      this.tableroAsignacion.reserva.push(...this.tableroAsignacion.empleados[idEmpleado]);
    }
    delete this.tableroAsignacion.empleados[idEmpleado];
    this.dropListIds = ['reserva', ...this.seleccionados.map(id => `emp-${id}`)];
  }

  getEquipoCupo(tipoEquipoId: number | null): number | null {
    if (!tipoEquipoId || !this.requerimientos?.totales?.equipos?.length) return null;
    const found = this.requerimientos.totales.equipos.find(req => req.tipoEquipoId === tipoEquipoId);
    return found ? found.cantidad : 0; // tipos no requeridos quedan con cupo 0
  }

  isEquipoDisabled(e: DisponibilidadEquipo): boolean {
    if (!e.disponible) return true;
    const cupo = this.getEquipoCupo(e.idTipoEquipo);
    if (cupo === null) return false;
    const seleccionadosTipo = this.selectedEquipos
      .map(id => this.equiposDisponibles.find(eq => eq.idEquipo === id))
      .filter(eq => eq && eq.idTipoEquipo === e.idTipoEquipo).length;
    const excedido = cupo === 0 || seleccionadosTipo >= cupo;
    return excedido && !this.selectedEquipos.includes(e.idEquipo);
  }

  getSeleccionadosEquipoPorTipo(tipoEquipoId: number | null): number {
    if (!tipoEquipoId) return this.selectedEquipos.length;
    return this.selectedEquipos
      .map(id => this.equiposDisponibles.find(eq => eq.idEquipo === id))
      .filter(eq => eq && eq.idTipoEquipo === tipoEquipoId).length;
  }

  irAlPaso(target: number): void {
    if (target === this.stepIndex) return;
    if (target < 0 || target > 2) return;
    if (target === 0) {
      this.stepIndex = 0;
      return;
    }
    if (target === 1) {
      if (!this.seleccionados.length) return;
      this.stepIndex = 1;
      return;
    }
    // target === 2
    if (!this.seleccionados.length || !this.selectedEquipos.length) return;
    const yaInicializado = this.dropListIds.length > 0 || this.tableroAsignacion.reserva.length || Object.keys(this.tableroAsignacion.empleados).length;
    if (!yaInicializado) {
      this.inicializarTableroAsignacion();
    }
    this.dropListIds = ['reserva', ...this.seleccionados.map(id => `emp-${id}`)];
    this.stepIndex = 2;
  }

  avanzarPaso(): void {
    if (this.stepIndex === 0 && !this.seleccionados.length) return;
    if (this.stepIndex === 1 && !this.selectedEquipos.length) return;
    if (this.stepIndex === 1) {
      const empleadosActuales = new Set<number>(this.seleccionados);
      this.seleccionados.forEach(id => {
        if (!this.tableroAsignacion.empleados[id]) {
          this.tableroAsignacion.empleados[id] = [];
        }
      });

      const equiposYaUbicados = new Set<number>([
        ...this.tableroAsignacion.reserva,
        ...Object.values(this.tableroAsignacion.empleados).flat()
      ]);
      this.selectedEquipos.forEach(idEq => {
        if (!equiposYaUbicados.has(idEq)) {
          this.tableroAsignacion.reserva.push(idEq);
        }
      });

      const yaInicializado = this.dropListIds.length > 0 || this.tableroAsignacion.reserva.length || Object.keys(this.tableroAsignacion.empleados).length;
      if (!yaInicializado) {
        this.inicializarTableroAsignacion();
      }
      this.dropListIds = ['reserva', ...this.seleccionados.map(id => `emp-${id}`)];
    }
    this.stepIndex = Math.min(2, this.stepIndex + 1);
  }

  retrocederPaso(): void {
    this.stepIndex = Math.max(0, this.stepIndex - 1);
  }

  getEquiposSeleccionados(): DisponibilidadEquipo[] {
    return this.equiposDisponibles.filter(e => this.selectedEquipos.includes(e.idEquipo));
  }

  getEquiposFiltrados(): DisponibilidadEquipo[] {
    const filtrados = this.equiposDisponibles.filter(e => e.disponible);
    if (!this.filtroTipoEquipoId) return filtrados;
    return filtrados.filter(e => e.idTipoEquipo === this.filtroTipoEquipoId);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDisponibilidad(proyectoId: number): void {
    if (!proyectoId) {
      this.disponiblesPersonal = [];
      this.equiposDisponibles = [];
      return;
    }
    const rango = this.getRangoPedido();
    const fechas = rango ?? (() => {
      const hoy = new Date().toISOString().split('T')[0];
      return { inicio: hoy, fin: hoy };
    })();

    this.proyectoService.getDisponibilidad({
      fechaInicio: fechas.inicio,
      fechaFin: fechas.fin,
      proyectoId
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.disponiblesPersonal = Array.isArray(data?.empleados) ? data.empleados.filter(e => e.operativoCampo) : [];
          this.equiposDisponibles = Array.isArray(data?.equipos) ? data.equipos : [];
        },
        error: err => {
          console.error('[proyecto] disponibilidad', err);
          this.disponiblesPersonal = [];
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

  private loadPedido(pedidoId: number): void {
    if (!pedidoId) return;
    this.visualizarService.getPedidoById(pedidoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.pedidoDetalle = data;
          if (this.proyecto?.proyectoId) {
            this.loadDisponibilidad(this.proyecto.proyectoId);
          }
        },
        error: (err) => {
          console.error('[pedido] detalle', err);
          this.pedidoDetalle = null;
        }
      });
  }

  private loadAsignaciones(proyectoId: number): void {
    if (!proyectoId) return;
    this.proyectoService.getAsignaciones(proyectoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          if (this.proyecto) {
            this.proyecto = { ...this.proyecto, recursos: lista ?? [] };
          }
          this.buildDevolucionForm(lista ?? []);
          this.devolucionesRegistradas = this.devolucionesCompletas(lista ?? []);
        },
        error: (err) => {
          console.error('[proyecto] asignaciones', err);
        }
      });
  }

  guardarProyecto(): void {
    if (!this.proyecto?.proyectoId) return;
    if (this.proyectoForm.invalid) {
      this.proyectoForm.markAllAsTouched();
      return;
    }

    const raw = this.proyectoForm.value;
    const cambios: Partial<ProyectoDetalle> = {};
    const estadoActualId = this.proyecto?.estadoId ?? null;

    this.addIfChanged(cambios, 'proyectoNombre', raw.proyectoNombre, this.proyecto?.proyectoNombre, 'string');
    this.addIfChanged(cambios, 'estadoId', raw.estadoId, this.proyecto?.estadoId, 'number');
    this.addIfChanged(cambios, 'responsableId', raw.responsableId, this.proyecto?.responsableId, 'number');
    this.addIfChanged(cambios, 'fechaInicioEdicion', raw.fechaInicioEdicion, this.proyecto?.fechaInicioEdicion, 'date');
    this.addIfChanged(cambios, 'fechaFinEdicion', raw.fechaFinEdicion, this.proyecto?.fechaFinEdicion, 'date');
    this.addIfChanged(cambios, 'enlace', raw.enlace, this.proyecto?.enlace, 'string');
    this.addIfChanged(cambios, 'notas', raw.notas, this.proyecto?.notas, 'string');
    this.addIfChanged(cambios, 'multimedia', raw.multimedia, this.proyecto?.multimedia, 'number');
    this.addIfChanged(cambios, 'edicion', raw.edicion, this.proyecto?.edicion, 'number');

    const keysCambios = Object.keys(cambios);
    if (!keysCambios.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sin cambios',
        text: 'No hay campos modificados para enviar.'
      });
      return;
    }

    const estadoDestinoId = 'estadoId' in cambios ? (cambios.estadoId ?? null) : estadoActualId;
    const estadoDestinoNombre = this.getEstadoNombre(estadoDestinoId) ?? this.proyecto?.estadoNombre ?? null;
    const estadoActualNombre = this.proyecto?.estadoNombre ?? this.getEstadoNombre(estadoActualId) ?? null;

    if (!this.isEstadoPlanificado(estadoActualId, estadoActualNombre) && this.isEstadoPlanificado(estadoDestinoId, estadoDestinoNombre)) {
      Swal.fire({
        icon: 'warning',
        title: 'No puedes volver a Planificado',
        text: 'Una vez que sales de Planificado no es posible regresar.'
      });
      return;
    }

    if (!this.isEstadoEjecucion(estadoActualId, estadoActualNombre) && this.isEstadoEjecucion(estadoDestinoId, estadoDestinoNombre) && !this.tieneAsignaciones()) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan asignaciones',
        text: 'Asigna al menos un recurso antes de pasar a Ejecución.'
      });
      return;
    }

    if (this.isEstadoEjecucion(estadoActualId, estadoActualNombre) && !this.isEstadoEjecucion(estadoDestinoId, estadoDestinoNombre)) {
      const hayEquipos = (this.proyecto?.recursos?.length ?? 0) > 0;
      if (hayEquipos && !this.devolucionesRegistradas) {
        Swal.fire({
          icon: 'warning',
          title: 'Termina las devoluciones',
          text: 'Registra las devoluciones antes de cambiar a otro estado.'
        });
        return;
      }
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
            ...cambios,
            estadoNombre: this.getEstadoNombre(cambios.estadoId ?? this.proyecto?.estadoId ?? null)
          } as ProyectoDetalle;
          const esEjecucionDestino = this.isEstadoEjecucion(estadoDestinoId, estadoDestinoNombre);
          this.devolucionesRegistradas = esEjecucionDestino ? (this.proyecto?.recursos?.length ?? 0) === 0 : this.devolucionesRegistradas;
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
    return this.seleccionados.some(id => !(this.tableroAsignacion.empleados[id]?.length));
  }

  getCargoEmpleado(id: number | null): string {
    if (!id) return '';
    const found = this.disponiblesPersonal.find(p => p.empleadoId === id);
    return found?.cargo || '';
  }

  dropEquipo(event: CdkDragDrop<number[]>, destino: 'reserva' | number): void {
    const targetList = event.container.data as number[];
    const prevList = event.previousContainer.data as number[];

    if (event.previousContainer === event.container) {
      moveItemInArray(targetList, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(prevList, targetList, event.previousIndex, event.currentIndex);
    }

    if (destino === 'reserva') {
      this.tableroAsignacion.reserva = targetList;
    } else {
      this.tableroAsignacion.empleados[destino] = targetList;
    }
  }

  getListaReserva(): number[] {
    return this.tableroAsignacion.reserva;
  }

  getListaEmpleado(idEmpleado: number): number[] {
    if (!this.tableroAsignacion.empleados[idEmpleado]) {
      this.tableroAsignacion.empleados[idEmpleado] = [];
    }
    return this.tableroAsignacion.empleados[idEmpleado];
  }

  getDropConnections(targetId: string): string[] {
    return this.dropListIds.filter(id => id !== targetId);
  }

  getEventosPedido(): any[] {
    const eventos = this.pedidoDetalle?.eventos;
    if (!Array.isArray(eventos)) return [];
    return [...eventos].sort((a, b) => {
      const fa = (a?.fecha ?? '').toString();
      const fb = (b?.fecha ?? '').toString();
      return fa.localeCompare(fb);
    });
  }

  private inicializarTableroAsignacion(): void {
    const reserva = [...this.selectedEquipos];
    const empleados: Record<number, number[]> = {};
    this.seleccionados.forEach(id => { empleados[id] = []; });
    this.tableroAsignacion = { reserva, empleados };
    this.dropListIds = ['reserva', ...this.seleccionados.map(id => `emp-${id}`)];
  }

  private quitarEquipoDeTablero(idEquipo: number): void {
    this.tableroAsignacion.reserva = this.tableroAsignacion.reserva.filter(id => id !== idEquipo);
    Object.keys(this.tableroAsignacion.empleados).forEach(key => {
      const k = Number(key);
      this.tableroAsignacion.empleados[k] = (this.tableroAsignacion.empleados[k] ?? []).filter(id => id !== idEquipo);
    });
  }

  private limpiarEquiposNoSeleccionados(): void {
    const seleccionadosSet = new Set(this.selectedEquipos);
    this.tableroAsignacion.reserva = (this.tableroAsignacion.reserva ?? []).filter(id => seleccionadosSet.has(id));
    Object.keys(this.tableroAsignacion.empleados).forEach(key => {
      const k = Number(key);
      this.tableroAsignacion.empleados[k] = (this.tableroAsignacion.empleados[k] ?? []).filter(id => seleccionadosSet.has(id));
    });
  }

  getPedidoRangoFechas(): { inicio: string; fin: string } | null {
    const eventos = (this.pedidoDetalle?.eventos ?? []) as Array<{ fecha?: string | null }>;
    const fechas = eventos
      .map(e => e.fecha)
      .filter(f => !!f)
      .map(f => f as string);
    if (!fechas.length) return null;
    fechas.sort();
    return { inicio: fechas[0], fin: fechas[fechas.length - 1] };
  }

  private getRangoPedido(): { inicio: string; fin: string } {
    const eventos = (this.pedidoDetalle?.eventos ?? []) as Array<{ fecha?: string | null }>;
    const fechas = eventos
      .map(e => e.fecha)
      .filter(f => !!f)
      .map(f => f as string);
    if (!fechas.length) {
      const hoy = new Date().toISOString().split('T')[0];
      return { inicio: hoy, fin: hoy };
    }
    fechas.sort();
    const inicio = fechas[0];
    const fin = fechas[fechas.length - 1];
    return { inicio, fin };
  }

  getServiciosContratados(): Array<{ nombre: string; evento: string; precio: number; notas: string }> {
    const items = (this.pedidoDetalle?.items ?? this.pedidoDetalle?.pedido?.items ?? []) as any[];
    if (!Array.isArray(items)) return [];
    return items.map(it => ({
      nombre: it.nombre ?? it.descripcion ?? it.titulo ?? '',
      evento: it.eventoNombre ?? it.evento ?? it.eventoCodigo ?? '',
      precio: Number(it.precioUnit ?? it.precio ?? it.costo ?? 0),
      notas: it.notas ?? ''
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

  toDateInput(value: string | null): string {
    if (!value) return '';
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
  }

  private getEstadoNombre(id: number | null): string | null {
    if (!id) return null;
    const found = this.estados.find(e => e.estadoId === id);
    return found?.estadoNombre ?? null;
  }

  private normalizeEstadoNombre(value: string | null): string {
    if (!value) return '';
    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/á/g, 'a')
      .replace(/é/g, 'e')
      .replace(/í/g, 'i')
      .replace(/ó/g, 'o')
      .replace(/ú/g, 'u')
      .replace(/ü/g, 'u');
  }

  private isEstadoPlanificado(id: number | null, nombre?: string | null): boolean {
    const label = nombre ?? this.getEstadoNombre(id) ?? '';
    return this.normalizeEstadoNombre(label) === 'planificado';
  }

  private isEstadoEjecucion(id: number | null, nombre?: string | null): boolean {
    const label = nombre ?? this.getEstadoNombre(id) ?? '';
    const norm = this.normalizeEstadoNombre(label);
    return norm === 'ejecucion' || norm === 'en ejecucion';
  }

  private devolucionesCompletas(recursos: ProyectoRecurso[]): boolean {
    if (!recursos.length) return true;
    return recursos.every(r => !!(r.equipoEstadoDevolucion && r.equipoEstadoDevolucion.toString().trim()));
  }

  private tieneAsignaciones(): boolean {
    return (this.proyecto?.recursos?.length ?? 0) > 0;
  }

  esPlanificadoActual(): boolean {
    return this.isEstadoPlanificado(this.proyecto?.estadoId ?? null, this.proyecto?.estadoNombre ?? null);
  }

  esEjecucionActual(): boolean {
    return this.isEstadoEjecucion(this.proyecto?.estadoId ?? null, this.proyecto?.estadoNombre ?? null);
  }

  puedeAsignarRecursos(): boolean {
    return !this.esEjecucionActual();
  }

  puedeRegistrarDevolucion(): boolean {
    return this.esEjecucionActual();
  }

  deshabilitarPlanificadoOption(id: number): boolean {
    return !this.esPlanificadoActual() && this.isEstadoPlanificado(id, this.getEstadoNombre(id));
  }

  private normalizeValue(value: any, type: 'string' | 'number' | 'date'): any {
    if (type === 'number') return this.toNumberOrNull(value);
    if (type === 'date') return this.toDateInput(value);
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    }
    return value;
  }

  private toNumberOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  getEquipoAsignadoA(equipoId: number): string {
    const recurso = this.proyecto?.recursos?.find(r => r.equipoId === equipoId);
    if (!recurso) return '';
    if (recurso.empleadoNombre) {
      return `Asignado a ${recurso.empleadoNombre}`;
    }
    return 'Reserva / Repuesto';
  }

  guardarDevoluciones(): void {
    if (!this.proyecto?.proyectoId) return;
    const items = this.devoluciones;
    if (!items.length) return;

    this.devolucionForm.markAllAsTouched();

    const faltaEstado = items.controls.some(ctrl => !ctrl.get('estadoDevolucion')?.value);
    if (faltaEstado) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan estados',
        text: 'Todos los equipos deben tener un estado de devolución.'
      });
      return;
    }

    const requiereNotas = items.controls.some(ctrl => {
      const estado = ctrl.get('estadoDevolucion')?.value;
      const notas = (ctrl.get('notas')?.value ?? '').trim();
      return (estado === 'daniado' || estado === 'faltante') && !notas;
    });

    if (requiereNotas) {
      Swal.fire({
        icon: 'warning',
        title: 'Agrega notas',
        text: 'Para equipos dañados o faltantes agrega una nota.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    if (!this.isEstadoEjecucion(this.proyecto?.estadoId ?? null, this.proyecto?.estadoNombre)) {
      Swal.fire({
        icon: 'warning',
        title: 'Fuera de Ejecución',
        text: 'Solo en estado Ejecución se pueden registrar devoluciones.'
      });
      return;
    }

    const payload = {
      devoluciones: items.value.map((item: any) => ({
        equipoId: item.equipoId,
        estadoDevolucion: item.estadoDevolucion,
        notas: item.notas ?? ''
      }))
    };

    this.guardandoDevoluciones = true;
    this.proyectoService.registrarDevoluciones(this.proyecto.proyectoId, payload)
      .pipe(finalize(() => { this.guardandoDevoluciones = false; }))
      .subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Devoluciones registradas',
            timer: 1800,
            showConfirmButton: false
          });
          this.devolucionesRegistradas = true;
          const recursosActualizados = (this.proyecto?.recursos ?? []).map(r => {
            const dev = items.value.find((d: any) => d.equipoId === r.equipoId);
            if (!dev) return r;
            return {
              ...r,
              equipoEstadoDevolucion: dev.estadoDevolucion,
              equipoNotasDevolucion: dev.notas,
              equipoFechaDevolucion: new Date().toISOString(),
              equipoDevuelto: 1
            } as ProyectoRecurso;
          });
          if (this.proyecto) {
            this.proyecto = { ...this.proyecto, recursos: recursosActualizados };
          }
        },
        error: (err) => {
          console.error('[proyecto] devoluciones', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo registrar',
            text: 'Intenta nuevamente más tarde.'
          });
        }
      });
  }

  private buildDevolucionForm(recursos: ProyectoRecurso[]): void {
    const arr = this.fb.array([]);
    const vistos = new Set<number>();

    (recursos ?? []).forEach(r => {
      if (vistos.has(r.equipoId)) return;
      vistos.add(r.equipoId);
      const estadoInicial = r.equipoEstadoDevolucion && r.equipoEstadoDevolucion.toString().trim()
        ? r.equipoEstadoDevolucion
        : 'devuelto';
      const notasInicial = r.equipoNotasDevolucion ?? '';
      arr.push(this.fb.group({
        equipoId: [r.equipoId],
        estadoDevolucion: [estadoInicial, Validators.required],
        notas: [notasInicial]
      }));
    });

    this.devolucionForm.setControl('devoluciones', arr);
    this.devolucionesRegistradas = this.devolucionesCompletas(recursos ?? []);
  }

  private addIfChanged(
    target: Partial<ProyectoDetalle>,
    key: keyof ProyectoDetalle,
    formValue: any,
    currentValue: any,
    type: 'string' | 'number' | 'date'
  ): void {
    const control = this.proyectoForm.get(key as string);
    if (!control || !control.dirty) return;
    const normalizedForm = this.normalizeValue(formValue, type);
    const normalizedCurrent = this.normalizeValue(currentValue, type);
    if (normalizedForm !== normalizedCurrent) {
      (target as Record<string, any>)[key as string] = normalizedForm;
    }
  }

  private patchProyectoForm(data: ProyectoDetalle): void {
    this.proyectoForm.patchValue({
      proyectoNombre: data.proyectoNombre,
      fechaInicioEdicion: this.toDateInput(data.fechaInicioEdicion),
      fechaFinEdicion: this.toDateInput(data.fechaFinEdicion),
      estadoId: data.estadoId,
      responsableId: data.responsableId,
      notas: data.notas,
      enlace: data.enlace,
      multimedia: data.multimedia,
      edicion: data.edicion
    });
  }

  private loadEstados(): void {
    this.proyectoService.getEstados()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.estados = Array.isArray(lista) ? lista : [];
        },
        error: (err) => {
          console.error('[proyecto] estados', err);
          this.estados = [];
        }
      });
  }
}
