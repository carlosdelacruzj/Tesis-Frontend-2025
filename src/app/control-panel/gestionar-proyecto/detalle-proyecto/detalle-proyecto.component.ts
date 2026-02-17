import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, Subject, takeUntil } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { MatStepper } from '@angular/material/stepper';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import {
  BloqueDia,
  EquipoDia,
  IncidenciaDia,
  ProyectoAsignacionEmpleadoPayload,
  ProyectoAsignacionEquipoPayload,
  ProyectoAsignacionesDisponiblesEquipo,
  ProyectoAsignacionesDisponiblesEmpleado,
  ProyectoAsignacionesPayload,
  ProyectoDetalle,
  ProyectoDia,
  ProyectoDetalleResponse,
  ProyectoDiaEstadoItem,
  ProyectoEstadoDevolucion,
  ProyectoPostproduccion,
  ProyectoPostproduccionPayload,
  ProyectoDevolucionEquiposPayload,
  ProyectoDevolucionAsyncJobStatusResponse,
  ProyectoDevolucionEquipoItem,
  ProyectoDevolucionPreviewResponse,
  ServicioDia
} from '../model/proyecto.model';
import { ProyectoService } from '../service/proyecto.service';
import { CatalogosService } from 'src/app/shared/services/catalogos.service';

type EstadoAsignacionDia = 'Sin asignar' | 'Pendiente' | 'Asignaciones completas' | '—';
type CancelacionResponsable = 'CLIENTE' | 'INTERNO';

type CancelacionDiaContexto = {
  responsable: CancelacionResponsable;
  motivo: string;
  notas: string;
};

type CancelacionMotivoOption = {
  value: string;
  label: string;
};

const CANCELACION_MOTIVOS: Record<CancelacionResponsable, CancelacionMotivoOption[]> = {
  CLIENTE: [
    { value: 'DESISTE_EVENTO', label: 'El cliente desiste del evento' },
    { value: 'FUERZA_MAYOR_CLIENTE', label: 'Fuerza mayor' },
    { value: 'OTRO_CLIENTE', label: 'Otro' }
  ],
  INTERNO: [
    { value: 'FUERZA_MAYOR_INTERNA', label: 'Fuerza mayor' },
    { value: 'OTRO_INTERNO', label: 'Otro' }
  ]
};

type IncidenciaResumen = {
  tipo: string;
  descripcion: string;
  incidenciaId: number;
  fechaHoraEvento?: string | null;
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
  private readonly catalogos = inject(CatalogosService);

  loading = true;
  error: string | null = null;
  detalle: ProyectoDetalleResponse | null = null;
  proyecto: ProyectoDetalle | null = null;
  modalAsignarAbierto = false;
  modalIncidenciaAbierto = false;
  modalIncidenciasListaAbierto = false;
  soloPendientes = false;
  openDiaId: number | null = null;
  asignacionDiaId: number | null = null;
  asignacionDiaLocked = false;
  asignacionEmpleados: ProyectoAsignacionEmpleadoPayload[] = [];
  asignacionEquipos: ProyectoAsignacionEquipoPayload[] = [];
  disponiblesEmpleados: ProyectoAsignacionesDisponiblesEmpleado[] = [];
  disponiblesEquipos: ProyectoAsignacionesDisponiblesEquipo[] = [];
  cargandoDisponibles = false;
  guardandoAsignaciones = false;
  asignacionSoloLectura = false;
  filtroRol: string | null = null;
  filtroTipoEquipo: string | null = null;
  searchEmpleado = '';
  searchEquipo = '';
  copiarDesdeDiaId: number | null = null;
  nuevoEmpleadoId: number | null = null;
  nuevoEquipoId: number | null = null;
  incidenciaDiaId: number | null = null;
  incidenciaListaDiaId: number | null = null;
  incidenciaFiltroTipo: '' | 'PERSONAL_NO_ASISTE' | 'EQUIPO_FALLA_EN_EVENTO' | 'EQUIPO_ROBO_PERDIDA' | 'OTROS' = '';
  incidenciaFiltroTexto = '';
  incidenciasVisibleCount = 20;
  incidenciaTipo: 'PERSONAL_NO_ASISTE' | 'EQUIPO_FALLA_EN_EVENTO' | 'EQUIPO_ROBO_PERDIDA' | 'OTROS' | '' = '';
  incidenciaDescripcion = '';
  incidenciaHora12 = '12';
  incidenciaMinuto = '00';
  incidenciaAmPm: 'AM' | 'PM' = 'AM';
  readonly incidenciaHoraOptions = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  readonly incidenciaMinutoOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
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
  mostrarSoloExcepcionesEstado = false;
  mostrarSoloExcepcionesDevolucion = false;
  devolucionFiltroResponsable = '';
  devolucionBusqueda = '';
  devolucionGruposAbiertos: Record<string, boolean> = {};
  devolucionDraft: Record<number, { estado: ProyectoEstadoDevolucion | ''; notas: string; fecha: string | null }> = {};
  guardandoDevolucion = false;
  private devolucionAsyncPollingTimer: number | null = null;
  postproduccion: ProyectoPostproduccion = {
    fechaInicioEdicion: null,
    fechaFinEdicion: null,
    preEntregaEnlace: null,
    preEntregaTipo: null,
    preEntregaFeedback: null,
    preEntregaFecha: null,
    respaldoUbicacion: null,
    respaldoNotas: null,
    entregaFinalEnlace: null,
    entregaFinalFecha: null
  };
  postproduccionOriginal: ProyectoPostproduccion = {
    fechaInicioEdicion: null,
    fechaFinEdicion: null,
    preEntregaEnlace: null,
    preEntregaTipo: null,
    preEntregaFeedback: null,
    preEntregaFecha: null,
    respaldoUbicacion: null,
    respaldoNotas: null,
    entregaFinalEnlace: null,
    entregaFinalFecha: null
  };
  guardandoPostproduccion = false;
  postEntregaMarcada = false;
  postEntregaFisicaRequerida = false;
  postTipoEntregaFisica = '';
  postFechaEntregaFisica: string | null = null;
  postResponsableEntregaFisica = '';
  postObservacionesEntregaFisica = '';
  stepperOrientation: 'horizontal' | 'vertical' = 'horizontal';
  ultimoDropDestino: number | 'reserva' | null = null;
  private dropHighlightTimer: number | null = null;
  tiposDetalleAbiertos: string[] = [];
  filtroModeloPorTipo: Record<string, string> = {};
  estadosDiaCatalogo: ProyectoDiaEstadoItem[] = [];
  estadoDiaLoading: Record<number, boolean> = {};
  estadoDiaMenuOpenId: number | null = null;
  estadoProyectoMenuOpen = false;
  iniciarEnCursoTrasAsignarDiaId: number | null = null;
  cancelandoGlobalProyecto = false;
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
  @ViewChild('asignacionesStepper') asignacionesStepper?: MatStepper;

  ngOnInit(): void {
    this.updateStepperOrientation();
    this.estadosDiaCatalogo = this.catalogos
      .getSnapshot<ProyectoDiaEstadoItem>('estadosDiasProyecto')
      .filter(item => item.activo === 1)
      .sort((a, b) => a.orden - b.orden);
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
          this.syncPostproduccionFromProyecto();
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
    if (this.devolucionAsyncPollingTimer !== null) {
      clearTimeout(this.devolucionAsyncPollingTimer);
      this.devolucionAsyncPollingTimer = null;
    }
  }

  abrirModalAsignar(diaId?: number): void {
    this.modalAsignarAbierto = true;
    const selected = diaId ?? this.openDiaId ?? this.detalle?.dias?.[0]?.diaId ?? null;
    this.asignacionDiaLocked = !!diaId;
    this.setAsignacionDia(selected);
  }

  cerrarModalAsignar(): void {
    if (!this.confirmCerrarAsignaciones()) return;
    this.saveAsignacionDraft();
    this.saveFiltrosDraft();
    this.modalAsignarAbierto = false;
    this.asignacionDiaLocked = false;
    this.iniciarEnCursoTrasAsignarDiaId = null;
  }

  abrirModalIncidencia(diaId?: number): void {
    const selected = diaId ?? this.openDiaId ?? this.detalle?.dias?.[0]?.diaId ?? null;
    if (!this.isDiaEnCurso(selected)) {
      void Swal.fire({
        icon: 'info',
        title: 'Incidencias solo en ejecución',
        text: 'Puedes registrar incidencias cuando el día está En curso.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    this.modalIncidenciaAbierto = true;
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

  @HostListener('document:click')
  onDocumentClick(): void {
    this.estadoDiaMenuOpenId = null;
    this.estadoProyectoMenuOpen = false;
  }


  cerrarModalIncidencia(): void {
    this.modalIncidenciaAbierto = false;
  }

  abrirModalIncidenciasDia(diaId: number): void {
    this.incidenciaListaDiaId = diaId;
    this.incidenciaFiltroTipo = '';
    this.incidenciaFiltroTexto = '';
    this.incidenciasVisibleCount = 20;
    this.modalIncidenciasListaAbierto = true;
  }

  cerrarModalIncidenciasDia(): void {
    this.modalIncidenciasListaAbierto = false;
    this.incidenciaListaDiaId = null;
  }

  canCambiarEstadoProyectoACancelado(): boolean {
    const estado = this.getEstadoProyectoNormalizado();
    return estado === 'planificado' || estado === 'en ejecucion' || estado === 'en ejecución';
  }

  toggleEstadoProyectoMenu(event?: Event): void {
    event?.stopPropagation();
    if (!this.canCambiarEstadoProyectoACancelado() || this.cancelandoGlobalProyecto) {
      this.estadoProyectoMenuOpen = false;
      return;
    }
    this.estadoProyectoMenuOpen = !this.estadoProyectoMenuOpen;
  }

  onEstadoProyectoSelectCancelado(): void {
    this.estadoProyectoMenuOpen = false;
    void this.cancelarProyectoGlobal();
  }

  toggleEstadoDiaMenu(diaId: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.estadosDiaCatalogo.length) return;
    this.estadoDiaMenuOpenId = this.estadoDiaMenuOpenId === diaId ? null : diaId;
  }

  async onEstadoDiaSelect(dia: ProyectoDia, estadoDiaId: number | null): Promise<void> {
    this.estadoDiaMenuOpenId = null;
    if (!estadoDiaId || this.estadoDiaLoading[dia.diaId]) {
      return;
    }
    const estadoActual = (dia.estadoDiaNombre ?? '').toString().trim().toLowerCase();
    const estadoNuevo = (this.getEstadoDiaNombre(estadoDiaId) ?? '').toString().trim().toLowerCase();
    if (!estadoNuevo) {
      return;
    }
    const estadoAsignacion = this.getEstadoAsignacionDia(dia.diaId);
    if (estadoActual === 'pendiente' && estadoNuevo === 'en curso' && estadoAsignacion !== 'Asignaciones completas' && estadoAsignacion !== '—') {
      void Swal.fire({
        icon: 'warning',
        title: 'Asignaciones incompletas',
        text: 'Completa las asignaciones del día antes de iniciar.',
        showCancelButton: true,
        confirmButtonText: 'Ir a asignar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
      }).then(result => {
        if (result.isConfirmed) {
          this.iniciarEnCursoTrasAsignarDiaId = dia.diaId;
          this.abrirModalAsignar(dia.diaId);
        }
      });
      return;
    }
    const confirmConfig = this.getConfirmacionEstadoDia(estadoActual, estadoNuevo);
    if (!confirmConfig) {
      return;
    }
    let contextoCancelacion: CancelacionDiaContexto | null = null;
    if (estadoNuevo === 'cancelado') {
      contextoCancelacion = await this.pedirContextoCancelacionDia(dia);
      if (!contextoCancelacion) {
        return;
      }
    }
    const fechaDia = this.toIsoDateOnly(dia.fecha);
    const hoy = this.toIsoDateOnly(new Date());
    const esInicioAnticipado = estadoActual === 'pendiente'
      && estadoNuevo === 'en curso'
      && !!fechaDia
      && !!hoy
      && fechaDia > hoy;
    const confirmTitle = esInicioAnticipado ? '¿Iniciar antes de la fecha programada?' : confirmConfig.title;
    const confirmText = esInicioAnticipado
      ? `El día está programado para ${this.formatFechaLarga(dia.fecha)}. Si continúas, se marcará como En curso desde hoy.`
      : confirmConfig.text;
    const confirmButtonText = esInicioAnticipado ? 'Sí, iniciar igual' : confirmConfig.confirmText;
    const confirmTextFinal = contextoCancelacion
      ? `${confirmText}\nMotivo: ${this.getCancelacionMotivoLabel(contextoCancelacion.responsable, contextoCancelacion.motivo)}.`
      : confirmText;
    const prevId = dia.estadoDiaId;
    const prevNombre = dia.estadoDiaNombre;
    this.estadoDiaLoading[dia.diaId] = true;

    void Swal.fire({
      icon: 'warning',
      title: confirmTitle,
      text: confirmTextFinal,
      showCancelButton: true,
      confirmButtonText: confirmButtonText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) {
        this.estadoDiaLoading[dia.diaId] = false;
        return;
      }

      const request$ = estadoNuevo === 'cancelado' && contextoCancelacion
        ? this.proyectoService.cancelarDia(dia.diaId, {
            responsable: contextoCancelacion.responsable,
            motivo: contextoCancelacion.motivo,
            notas: contextoCancelacion.notas || null
          })
        : this.proyectoService.actualizarEstadoDia(dia.diaId, estadoDiaId);

      request$
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            this.estadoDiaLoading[dia.diaId] = false;
          })
        )
      .subscribe({
        next: () => {
          dia.estadoDiaId = estadoDiaId;
          dia.estadoDiaNombre = this.getEstadoDiaNombre(estadoDiaId);
          this.refrescarProyectoDetalle();
          void Swal.fire({
            icon: 'success',
            title: this.getToastEstadoDiaTitle(estadoNuevo),
            text: `Día: ${this.formatFechaLarga(dia.fecha)}`,
            timer: 1500,
            showConfirmButton: false
          });
        },
        error: (err) => {
            console.error('[proyecto] estado dia', err);
            dia.estadoDiaId = prevId;
            dia.estadoDiaNombre = prevNombre;
            void Swal.fire({
              icon: 'error',
              title: 'No se pudo actualizar',
              text: this.getMensajeErrorCancelacion(err, false),
              confirmButtonText: 'Entendido'
            });
          }
        });
    });
  }

  async cancelarProyectoGlobal(): Promise<void> {
    const proyectoId = this.proyecto?.proyectoId;
    if (!proyectoId || this.cancelandoGlobalProyecto) {
      return;
    }
    if (!this.canCambiarEstadoProyectoACancelado()) {
      return;
    }
    const diasYaCancelados = this.diasYaCanceladosCount;
    const diasPorCancelar = this.diasNoCanceladosCount;
    const montoNcEstimado = this.montoNcEstimadoGlobal;

    const toOptionsHtml = (options: CancelacionMotivoOption[]): string =>
      options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');

    const formulario = await Swal.fire({
      icon: 'warning',
      title: 'Cancelar proyecto globalmente',
      html: `
        <div style="text-align:left;display:grid;gap:10px;">
          <div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:10px;">
            <p style="margin:0 0 4px 0;font-size:13px;color:#0f172a;"><strong>Resumen previo</strong></p>
            <p style="margin:0;font-size:12px;color:#334155;">Días ya cancelados: <strong>${diasYaCancelados}</strong></p>
            <p style="margin:0;font-size:12px;color:#334155;">Días que se cancelarán ahora: <strong>${diasPorCancelar}</strong></p>
            <p id="cancelacionGlobalNcHint" style="margin:4px 0 0 0;font-size:12px;color:#334155;">
              Si cancela el cliente, no se generará nota de crédito.
            </p>
          </div>
          <p style="margin:0;color:#475569;font-size:13px;">
            Esta acción cancelará todos los días no cancelados del proyecto y registrará la causa.
          </p>
          <label style="font-size:13px;font-weight:600;color:#0f172a;">Responsable</label>
          <select id="cancelacionGlobalResponsable" class="swal2-select" style="width:100%;margin:0;">
            <option value="CLIENTE">Cliente</option>
            <option value="INTERNO">Interno (nosotros)</option>
          </select>
          <label style="font-size:13px;font-weight:600;color:#0f172a;">Motivo</label>
          <select id="cancelacionGlobalMotivo" class="swal2-select" style="width:100%;margin:0;">
            ${toOptionsHtml(CANCELACION_MOTIVOS.CLIENTE)}
          </select>
          <label style="font-size:13px;font-weight:600;color:#0f172a;">Notas (opcional)</label>
          <textarea id="cancelacionGlobalNotas" class="swal2-textarea" style="width:100%;margin:0;" maxlength="500" placeholder="Detalle adicional para auditoría interna."></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      didOpen: () => {
        const responsableEl = document.getElementById('cancelacionGlobalResponsable') as HTMLSelectElement | null;
        const motivoEl = document.getElementById('cancelacionGlobalMotivo') as HTMLSelectElement | null;
        const ncHintEl = document.getElementById('cancelacionGlobalNcHint') as HTMLElement | null;
        if (!responsableEl || !motivoEl) return;
        const refreshMotivos = () => {
          const responsable = (responsableEl.value === 'INTERNO' ? 'INTERNO' : 'CLIENTE') as CancelacionResponsable;
          motivoEl.innerHTML = toOptionsHtml(CANCELACION_MOTIVOS[responsable]);
          if (ncHintEl) {
            ncHintEl.textContent = responsable === 'INTERNO'
              ? `Si es cancelación interna, NC estimada: ${montoNcEstimado}.`
              : 'Si cancela el cliente, no se generará nota de crédito.';
          }
        };
        responsableEl.addEventListener('change', refreshMotivos);
        refreshMotivos();
      },
      preConfirm: () => {
        const responsableEl = document.getElementById('cancelacionGlobalResponsable') as HTMLSelectElement | null;
        const motivoEl = document.getElementById('cancelacionGlobalMotivo') as HTMLSelectElement | null;
        const notasEl = document.getElementById('cancelacionGlobalNotas') as HTMLTextAreaElement | null;
        const responsable = (responsableEl?.value === 'INTERNO' ? 'INTERNO' : 'CLIENTE') as CancelacionResponsable;
        const motivo = (motivoEl?.value ?? '').toString().trim();
        const notas = (notasEl?.value ?? '').toString().trim();
        if (!motivo) {
          Swal.showValidationMessage('Selecciona un motivo de cancelación.');
          return null;
        }
        if ((motivo === 'OTRO_CLIENTE' || motivo === 'OTRO_INTERNO') && notas.length < 8) {
          Swal.showValidationMessage('Cuando eliges "Otro", agrega al menos 8 caracteres en notas.');
          return null;
        }
        return { responsable, motivo, notas } as CancelacionDiaContexto;
      }
    });

    if (!formulario.isConfirmed) {
      return;
    }

    const contexto = formulario.value as CancelacionDiaContexto;
    this.cancelandoGlobalProyecto = true;

    this.proyectoService.cancelarGlobalProyecto(proyectoId, {
      responsable: contexto.responsable,
      motivo: contexto.motivo,
      notas: contexto.notas || null
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.cancelandoGlobalProyecto = false; })
      )
      .subscribe({
        next: (response) => {
          this.refrescarProyectoDetalle();
          const detalleNc = response.ncRequerida === 1
            ? `\nNC requerida: Sí${response.voucherId ? ` (Voucher #${response.voucherId})` : ''}\nMonto NC total: ${response.montoNcTotal ?? 0}`
            : '\nNC requerida: No';
          void Swal.fire({
            icon: 'success',
            title: 'Proyecto cancelado',
            text: `Días cancelados en esta operación: ${response.diasCanceladosOperacion}\nDías ya cancelados: ${response.diasYaCancelados}${detalleNc}`,
            confirmButtonText: 'Entendido'
          });
        },
        error: (err) => {
          console.error('[proyecto] cancelar global', err);
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo cancelar',
            text: this.getMensajeErrorCancelacion(err, true),
            confirmButtonText: 'Entendido'
          });
        }
      });
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
      this.asignacionSoloLectura = false;
      return;
    }
    const dia = this.detalle.dias?.find(d => d.diaId === diaId);
    const estado = (dia?.estadoDiaNombre ?? '').toString().trim().toLowerCase();
    this.asignacionSoloLectura = estado !== 'pendiente';
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
    if (this.asignacionSoloLectura) return;
    if (!empleadoId) return;
    if (!this.puedeAgregarEmpleado(empleadoId)) return;
    this.nuevoEmpleadoId = empleadoId;
    this.agregarEmpleado();
  }

  onEquipoSeleccionado(equipoId: number | null): void {
    if (this.asignacionSoloLectura) return;
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
    this.setIncidenciaHoraActual();
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
    const fechaDiaRaw = this.detalle?.dias?.find(d => d.diaId === this.incidenciaDiaId)?.fecha ?? '';
    const fechaDia = String(fechaDiaRaw).slice(0, 10);
    const now = new Date();
    const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const horaNum = Number(this.incidenciaHora12);
    const minNum = Number(this.incidenciaMinuto);
    let horaEvento = horaActual;
    if (Number.isFinite(horaNum) && horaNum >= 1 && horaNum <= 12 && Number.isFinite(minNum) && minNum >= 0 && minNum <= 59) {
      let hours24 = horaNum % 12;
      if (this.incidenciaAmPm === 'PM') {
        hours24 += 12;
      }
      horaEvento = `${String(hours24).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;
    }
    const fechaBase = /^\d{4}-\d{2}-\d{2}$/.test(fechaDia)
      ? fechaDia
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const payload = {
      tipo: this.incidenciaTipo as 'PERSONAL_NO_ASISTE' | 'EQUIPO_FALLA_EN_EVENTO' | 'EQUIPO_ROBO_PERDIDA' | 'OTROS',
      descripcion: this.incidenciaDescripcion.trim(),
      fechaHoraEvento: `${fechaBase} ${horaEvento}:00`,
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
    if (this.asignacionSoloLectura) return;
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
    if (this.asignacionSoloLectura) return;
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
    if (this.asignacionSoloLectura) return;
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
    if (this.asignacionSoloLectura) return;
    this.asignacionEquipos = this.asignacionEquipos.filter((_, i) => i !== index);
  }

  onEquipoDrop(event: CdkDragDrop<unknown>, responsableId: number | null): void {
    if (this.asignacionSoloLectura) return;
    const item = event.item?.data as ProyectoAsignacionEquipoPayload | undefined;
    if (!item) return;
    const target = responsableId ?? null;
    if (item.responsableId === target) return;
    item.responsableId = target;
    this.asignacionEquipos = [...this.asignacionEquipos];
    this.marcarDrop(target);
  }

  copiarAsignacionesDesde(diaId: number | null): void {
    if (this.asignacionSoloLectura) return;
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

  getDiaAnteriorId(diaId: number | null): number | null {
    if (!diaId) return null;
    const index = this.diasOrdenadosCache.findIndex(d => d.diaId === diaId);
    if (index <= 0) return null;
    return this.diasOrdenadosCache[index - 1]?.diaId ?? null;
  }

  copiarAsignacionesDiaAnterior(): void {
    if (this.asignacionSoloLectura) return;
    const anteriorId = this.getDiaAnteriorId(this.asignacionDiaId);
    if (!anteriorId) return;
    this.copiarAsignacionesDesde(anteriorId);
  }

  irADiaConPendientesAsignacion(): void {
    const diaPendiente = this.diasOrdenadosCache.find(d => {
      const pendientes = this.getPendientesDia(d.diaId);
      return pendientes.personal > 0 || pendientes.equipos > 0;
    });
    if (!diaPendiente) return;
    this.setAsignacionDia(diaPendiente.diaId);
  }

  limpiarAsignacionesDia(): void {
    if (this.asignacionSoloLectura) return;
    this.asignacionEmpleados = [];
    this.asignacionEquipos = [];
    this.saveAsignacionDraft();
  }

  guardarAsignacionesDia(): void {
    if (this.asignacionSoloLectura) return;
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
                const targetDiaId = this.asignacionDiaId;
                if (targetDiaId && this.iniciarEnCursoTrasAsignarDiaId === targetDiaId) {
                  const estadoEnCursoId = this.estadosDiaCatalogo
                    .find(item => (item.estadoDiaNombre ?? '').toString().trim().toLowerCase() === 'en curso')
                    ?.estadoDiaId;
                  if (estadoEnCursoId) {
                    this.estadoDiaLoading[targetDiaId] = true;
                    this.proyectoService.actualizarEstadoDia(targetDiaId, estadoEnCursoId)
                      .pipe(finalize(() => { this.estadoDiaLoading[targetDiaId] = false; }))
                      .subscribe({
                        next: () => {
                          console.log('[trace][proyecto] auto estado dia -> en curso OK', {
                            diaId: targetDiaId,
                            estadoDiaId: estadoEnCursoId
                          });
                          const dia = this.detalle?.dias?.find(d => d.diaId === targetDiaId);
                          if (dia) {
                            dia.estadoDiaId = estadoEnCursoId;
                            dia.estadoDiaNombre = this.getEstadoDiaNombre(estadoEnCursoId);
                          }
                          this.rebuildDiaCaches();
                          this.refrescarProyectoDetalle();
                        },
                        error: err => {
                          console.error('[proyecto] estado dia auto en curso', err);
                          console.log('[trace][proyecto] auto estado dia -> en curso ERROR', {
                            diaId: targetDiaId,
                            estadoDiaId: estadoEnCursoId,
                            status: err?.status,
                            statusText: err?.statusText,
                            url: err?.url,
                            error: err?.error
                          });
                          if (!this.proyecto?.proyectoId) {
                            void Swal.fire({
                              icon: 'error',
                              title: 'No se pudo iniciar el día',
                              text: 'Las asignaciones se guardaron, pero no se pudo cambiar a En curso.'
                            });
                            return;
                          }
                          this.proyectoService.getProyecto(this.proyecto.proyectoId)
                            .pipe(takeUntil(this.destroy$))
                            .subscribe({
                              next: refreshed => {
                                this.detalle = refreshed;
                                this.proyecto = refreshed?.proyecto ?? null;
                                this.rebuildDiaCaches();
                                const diaRefrescado = this.detalle?.dias?.find(d => d.diaId === targetDiaId);
                                const estadoRefrescado = (diaRefrescado?.estadoDiaNombre ?? '').toString().trim().toLowerCase();
                                console.log('[trace][proyecto] auto estado dia refresh tras error', {
                                  diaId: targetDiaId,
                                  estadoRefrescado: diaRefrescado?.estadoDiaNombre ?? null
                                });
                                if (estadoRefrescado === 'en curso') {
                                  return;
                                }
                                void Swal.fire({
                                  icon: 'error',
                                  title: 'No se pudo iniciar el día',
                                  text: 'Las asignaciones se guardaron, pero no se pudo cambiar a En curso.'
                                });
                              },
                              error: refreshErr => {
                                console.error('[proyecto] estado dia auto en curso refresh', refreshErr);
                                void Swal.fire({
                                  icon: 'error',
                                  title: 'No se pudo iniciar el día',
                                  text: 'Las asignaciones se guardaron, pero no se pudo confirmar el cambio a En curso.'
                                });
                              }
                            });
                        }
                      });
                  }
                }
                this.iniciarEnCursoTrasAsignarDiaId = null;
                this.cerrarModalAsignar();
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

  private confirmCerrarAsignaciones(): boolean {
    if (this.asignacionSoloLectura) return true;
    if (!this.asignacionDiaId) return true;
    if (!this.isAsignacionDiaDirty(this.asignacionDiaId)) return true;
    return window.confirm('Tienes cambios sin guardar. ¿Seguro que deseas cerrar?');
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

  getIncidenciasRecientesDia(diaId: number, limit = 3): IncidenciaResumen[] {
    return this.getIncidenciasDia(diaId).slice(0, limit);
  }

  getIncidenciasCountDia(diaId: number): number {
    return this.getDiaResumen(diaId).incidenciasCount;
  }

  getIncidenciaTipoLabel(tipo: string): string {
    switch ((tipo ?? '').toString().trim().toUpperCase()) {
      case 'PERSONAL_NO_ASISTE':
        return 'Personal no asiste';
      case 'EQUIPO_FALLA_EN_EVENTO':
        return 'Equipo falla en evento';
      case 'EQUIPO_ROBO_PERDIDA':
        return 'Equipo robo/pérdida';
      default:
        return 'Otros';
    }
  }

  getIncidenciaSeveridad(inc: IncidenciaResumen): 'alta' | 'media' | 'baja' {
    const tipo = (inc.tipo ?? '').toString().trim().toUpperCase();
    if (tipo === 'EQUIPO_ROBO_PERDIDA' || tipo === 'EQUIPO_FALLA_EN_EVENTO') return 'alta';
    if (tipo === 'PERSONAL_NO_ASISTE') return 'media';
    return 'baja';
  }

  getIncidenciasModalFiltradas(): IncidenciaResumen[] {
    const diaId = this.incidenciaListaDiaId;
    if (!diaId) return [];
    let lista = [...this.getIncidenciasDia(diaId)];
    if (this.incidenciaFiltroTipo) {
      lista = lista.filter(item => (item.tipo ?? '').toString().trim().toUpperCase() === this.incidenciaFiltroTipo);
    }
    const query = this.incidenciaFiltroTexto.trim().toLowerCase();
    if (query) {
      lista = lista.filter(item => {
        const target = `${this.getIncidenciaTipoLabel(item.tipo)} ${item.descripcion} ${item.fechaHoraEvento ?? ''} ${item.createdAt ?? ''} ${item.empleadoNombre ?? ''} ${item.empleadoReemplazoNombre ?? ''}`.toLowerCase();
        return target.includes(query);
      });
    }
    return lista.slice(0, this.incidenciasVisibleCount);
  }

  canCargarMasIncidenciasModal(): boolean {
    const diaId = this.incidenciaListaDiaId;
    if (!diaId) return false;
    const total = this.getIncidenciasDia(diaId).length;
    return this.incidenciasVisibleCount < total;
  }

  cargarMasIncidenciasModal(): void {
    this.incidenciasVisibleCount += 20;
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
    if (this.asignacionSoloLectura) return;
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
    if (this.asignacionSoloLectura) return;
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
    if (this.asignacionSoloLectura) return;
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
    if (this.asignacionSoloLectura) return;
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
    const diasPendientes = this.getDiasDevolucionPendientes();
    if (!diasPendientes.length) {
      void Swal.fire({
        icon: 'info',
        title: 'Sin devoluciones pendientes',
        text: 'Todos los días ya tienen devoluciones registradas.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    const selected = diaId ?? this.openDiaId ?? diasPendientes[0]?.diaId ?? null;
    if (!selected) return;
    const targetDiaId = (this.isDiaPendienteDevolucion(selected) && this.isDiaFinalizado(selected))
      ? selected
      : (diasPendientes[0]?.diaId ?? null);
    if (!targetDiaId) return;
    if (!this.isDiaFinalizado(targetDiaId)) {
      void Swal.fire({
        icon: 'info',
        title: 'Devoluciones al cierre',
        text: 'Solo puedes registrar devoluciones cuando el día está Terminado o Cancelado.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    this.devolucionDiaId = targetDiaId;
    this.mostrarSoloExcepcionesDevolucion = false;
    this.modalDevolucionAbierto = true;
    this.cargarDevolucionDraft(targetDiaId);
  }

  onDevolucionDiaChange(diaId: number | null): void {
    if (!diaId) {
      this.devolucionDiaId = null;
      this.devolucionDraft = {};
      this.devolucionGruposAbiertos = {};
      return;
    }
    if (!this.isDiaPendienteDevolucion(diaId)) {
      this.devolucionDiaId = null;
      this.devolucionDraft = {};
      this.devolucionGruposAbiertos = {};
      return;
    }
    this.devolucionDiaId = diaId;
    this.mostrarSoloExcepcionesDevolucion = false;
    this.devolucionFiltroResponsable = '';
    this.devolucionBusqueda = '';
    this.devolucionGruposAbiertos = {};
    this.cargarDevolucionDraft(diaId);
  }

  marcarTodosDevueltos(): void {
    if (!this.devolucionDiaId) return;
    const nowIso = new Date().toISOString().slice(0, 16);
    this.getEquiposDevolucionDia(this.devolucionDiaId).forEach(eq => {
      this.devolucionDraft[eq.equipoId] = {
        estado: 'DEVUELTO',
        notas: this.devolucionDraft[eq.equipoId]?.notas ?? '',
        fecha: this.devolucionDraft[eq.equipoId]?.fecha ?? nowIso
      };
    });
    this.devolucionDraft = { ...this.devolucionDraft };
  }

  cerrarModalDevolucion(): void {
    this.modalDevolucionAbierto = false;
    this.devolucionDiaId = null;
    this.devolucionDraft = {};
  }

  private syncPostproduccionFromProyecto(): void {
    const data = this.detalle?.postproduccion ?? null;
    if (!data) {
      const vacio: ProyectoPostproduccion = {
        fechaInicioEdicion: null,
        fechaFinEdicion: null,
        preEntregaEnlace: null,
        preEntregaTipo: null,
        preEntregaFeedback: null,
        preEntregaFecha: null,
        respaldoUbicacion: null,
        respaldoNotas: null,
        entregaFinalEnlace: null,
        entregaFinalFecha: null
      };
      this.postproduccion = { ...vacio };
      this.postproduccionOriginal = { ...vacio };
      this.postEntregaMarcada = false;
    } else {
      const actual: ProyectoPostproduccion = {
        fechaInicioEdicion: data.fechaInicioEdicion ?? null,
        fechaFinEdicion: data.fechaFinEdicion ?? null,
        preEntregaEnlace: data.preEntregaEnlace ?? null,
        preEntregaTipo: data.preEntregaTipo ?? null,
        preEntregaFeedback: data.preEntregaFeedback ?? null,
        preEntregaFecha: data.preEntregaFecha ?? null,
        respaldoUbicacion: data.respaldoUbicacion ?? null,
        respaldoNotas: data.respaldoNotas ?? null,
        entregaFinalEnlace: data.entregaFinalEnlace ?? null,
        entregaFinalFecha: data.entregaFinalFecha ?? null
      };
      this.postproduccion = { ...actual };
      this.postproduccionOriginal = { ...actual };
      this.postEntregaMarcada = !!data.entregaFinalFecha;
    }
    this.postEntregaFisicaRequerida = false;
    this.postTipoEntregaFisica = '';
    this.postFechaEntregaFisica = null;
    this.postResponsableEntregaFisica = '';
    this.postObservacionesEntregaFisica = '';
  }

  iniciarEdicionPost(): void {
    if (!this.puedeIniciarEdicionPost) {
      void Swal.fire({
        icon: 'warning',
        title: 'Fase bloqueada',
        text: this.postproduccionSoloLecturaPorEstado
          ? 'El proyecto ya fue entregado/cerrado y no permite más edición.'
          : 'La fecha de inicio ya está registrada.'
      });
      return;
    }
    const hoy = this.getTodayIsoLocal();
    const fechaMinima = this.fechaMinInicioEdicion;
    const seleccionada = this.toIsoDateOnly(this.postproduccion.fechaInicioEdicion);
    const base = seleccionada ?? hoy;
    const fecha = fechaMinima && base < fechaMinima ? fechaMinima : base;
    if (seleccionada && fechaMinima && seleccionada < fechaMinima) {
      void Swal.fire({
        icon: 'warning',
        title: 'Fecha inválida',
        text: `La fecha de inicio no puede ser menor al último día de trabajo (${fechaMinima}).`
      });
      return;
    }
    void Swal.fire({
      icon: 'warning',
      title: '¿Confirmar inicio de edición?',
      text: `La fecha de inicio quedará registrada como ${this.formatFechaDisplay(fecha)} y luego no podrás editarla.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) return;
      this.postproduccion = { ...this.postproduccion, fechaInicioEdicion: fecha };
      this.guardarPostproduccionCambios('Edición iniciada', `Inicio: ${this.formatFechaDisplay(fecha)}`);
    });
  }

  enviarPreEntregaPost(): void {
    if (!this.puedeEditarPreEntregaPost) {
      void Swal.fire({
        icon: 'warning',
        title: 'Fase bloqueada',
        text: this.postproduccion.preEntregaFecha
          ? 'La pre-entrega ya fue enviada y no puede editarse.'
          : 'Primero debes iniciar la edición.'
      });
      return;
    }
    const enlace = (this.postproduccion.preEntregaEnlace ?? '').trim();
    if (!enlace) {
      void Swal.fire({
        icon: 'warning',
        title: 'Falta el enlace',
        text: 'Ingresa el enlace de pre-entrega.'
      });
      return;
    }
    if (!this.postproduccion.preEntregaTipo) {
      void Swal.fire({
        icon: 'warning',
        title: 'Selecciona el tipo',
        text: 'Indica si es video, fotos o ambos.'
      });
      return;
    }
    const fecha = this.getTodayIsoLocal();
    void Swal.fire({
      icon: 'warning',
      title: '¿Confirmar envío de pre-entrega?',
      text: `Se registrará como enviada el ${this.formatFechaDisplay(fecha)} y luego no podrás editarla.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) return;
      this.postproduccion = { ...this.postproduccion, preEntregaFecha: fecha };
      this.guardarPostproduccionCambios('Pre-entrega enviada', `Fecha: ${this.formatFechaDisplay(fecha)}`);
    });
  }

  cerrarEdicionPost(): void {
    if (!this.puedeCerrarEdicionPost) {
      void Swal.fire({
        icon: 'warning',
        title: 'Fase bloqueada',
        text: this.postproduccionOriginal.fechaFinEdicion
          ? 'La edición ya está cerrada y sus datos no pueden editarse.'
          : 'Debes enviar la pre-entrega antes de cerrar la edición.'
      });
      return;
    }
    const fechaInicio = this.toIsoDateOnly(this.postproduccion.fechaInicioEdicion);
    if (!fechaInicio) {
      void Swal.fire({
        icon: 'warning',
        title: 'Inicia la edición',
        text: 'Debes registrar la fecha de inicio de edición.'
      });
      return;
    }
    const fechaFin = this.toIsoDateOnly(this.postproduccion.fechaFinEdicion);
    if (!fechaFin) {
      void Swal.fire({
        icon: 'warning',
        title: 'Falta fecha fin',
        text: 'Debes registrar la fecha de fin de edición.'
      });
      return;
    }
    if (fechaFin <= fechaInicio) {
      void Swal.fire({
        icon: 'warning',
        title: 'Fecha inválida',
        text: `La fecha de fin debe ser mayor a la fecha de inicio (${fechaInicio}).`
      });
      return;
    }
    const ubicacion = (this.postproduccion.respaldoUbicacion ?? '').trim();
    if (!ubicacion) {
      void Swal.fire({
        icon: 'warning',
        title: 'Falta ubicación',
        text: 'Ingresa la ubicación física del respaldo.'
      });
      return;
    }
    void Swal.fire({
      icon: 'warning',
      title: '¿Confirmar cierre de edición?',
      text: `Se cerrará con fecha ${this.formatFechaDisplay(fechaFin)} y ya no podrás editar pre-entrega ni cierre.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) return;
      this.postproduccion = {
        ...this.postproduccion,
        fechaFinEdicion: fechaFin,
        respaldoUbicacion: ubicacion
      };
      this.guardarPostproduccionCambios('Edición cerrada', `Fin: ${this.formatFechaDisplay(fechaFin)}`);
    });
  }

  tienePagoCompleto(): boolean {
    const estadoPagoId = this.proyecto?.estadoPagoId ?? null;
    const estadoPagoNombre = (this.proyecto?.estadoPagoNombre ?? '').toString().trim().toLowerCase();
    return estadoPagoId === 3 || estadoPagoNombre === 'pagado';
  }

  marcarEntregaPost(): void {
    if (!this.puedeEditarEntregaFinalPost) {
      void Swal.fire({
        icon: 'warning',
        title: 'Fase bloqueada',
        text: 'Debes cerrar la edición antes de registrar la entrega final.'
      });
      return;
    }
    if (!this.postproduccion.fechaFinEdicion) {
      void Swal.fire({
        icon: 'warning',
        title: 'Edición pendiente',
        text: 'Debes cerrar la edición antes de entregar.'
      });
      return;
    }
    if (!this.tienePagoCompleto()) {
      void Swal.fire({
        icon: 'info',
        title: 'Pago incompleto',
        text: 'La entrega final requiere el pago completo.'
      });
      return;
    }
    const enlaceFinal = (this.postproduccion.entregaFinalEnlace ?? '').trim();
    if (!enlaceFinal) {
      void Swal.fire({
        icon: 'warning',
        title: 'Falta el enlace final',
        text: 'Ingresa el enlace final para entregar.'
      });
      return;
    }
    const fechaCierre = this.toIsoDateOnly(this.postproduccion.fechaFinEdicion);
    const fechaEntregaIngresada = this.toIsoDateOnly(this.postproduccion.entregaFinalFecha);
    if (fechaCierre && fechaEntregaIngresada && fechaEntregaIngresada < fechaCierre) {
      void Swal.fire({
        icon: 'warning',
        title: 'Fecha inválida',
        text: `La fecha de entrega final no puede ser menor al cierre de edición (${this.formatFechaDisplay(fechaCierre)}).`
      });
      return;
    }
    if (this.postEntregaFisicaRequerida && !this.postFechaEntregaFisica) {
      void Swal.fire({
        icon: 'warning',
        title: 'Entrega física pendiente',
        text: 'Registra la fecha de entrega física.'
      });
      return;
    }
    const fechaEntregaCalculada = this.toIsoDateOnly(this.postproduccion.entregaFinalFecha);
    if (!fechaEntregaCalculada) {
      void Swal.fire({
        icon: 'warning',
        title: 'Falta fecha de entrega',
        text: 'Selecciona la fecha de entrega final antes de marcar la entrega.'
      });
      return;
    }
    const fechaTexto = fechaEntregaCalculada;
    void Swal.fire({
      icon: 'warning',
      title: '¿Confirmar entrega final?',
      text: `Se registrará la entrega final con fecha ${this.formatFechaDisplay(fechaTexto)}.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) return;
      this.postproduccion = { ...this.postproduccion, entregaFinalFecha: fechaEntregaCalculada };
      this.postEntregaMarcada = true;
      this.guardarPostproduccionCambios(
        'Entrega marcada',
        `Entrega: ${this.formatFechaDisplay(fechaTexto)}`
      );
    });
  }

  private getPostproduccionCambios(): ProyectoPostproduccionPayload {
    const cambios: ProyectoPostproduccionPayload = {};
    const actual = this.postproduccion;
    const original = this.postproduccionOriginal;
    if (actual.fechaInicioEdicion !== original.fechaInicioEdicion) cambios.fechaInicioEdicion = actual.fechaInicioEdicion;
    if (actual.fechaFinEdicion !== original.fechaFinEdicion) cambios.fechaFinEdicion = actual.fechaFinEdicion;
    if (actual.preEntregaEnlace !== original.preEntregaEnlace) cambios.preEntregaEnlace = actual.preEntregaEnlace;
    if (actual.preEntregaTipo !== original.preEntregaTipo) cambios.preEntregaTipo = actual.preEntregaTipo;
    if (actual.preEntregaFeedback !== original.preEntregaFeedback) cambios.preEntregaFeedback = actual.preEntregaFeedback;
    if (actual.preEntregaFecha !== original.preEntregaFecha) cambios.preEntregaFecha = actual.preEntregaFecha;
    if (actual.respaldoUbicacion !== original.respaldoUbicacion) cambios.respaldoUbicacion = actual.respaldoUbicacion;
    if (actual.respaldoNotas !== original.respaldoNotas) cambios.respaldoNotas = actual.respaldoNotas;
    if (actual.entregaFinalEnlace !== original.entregaFinalEnlace) cambios.entregaFinalEnlace = actual.entregaFinalEnlace;
    if (actual.entregaFinalFecha !== original.entregaFinalFecha) cambios.entregaFinalFecha = actual.entregaFinalFecha;
    return cambios;
  }

  private guardarPostproduccionCambios(titulo: string, texto?: string): void {
    const proyectoId = this.proyecto?.proyectoId;
    if (!proyectoId) return;
    const cambios = this.getPostproduccionCambios();
    if (!Object.keys(cambios).length) {
      void Swal.fire({
        icon: 'info',
        title: 'Sin cambios',
        text: 'No hay actualizaciones pendientes en postproducción.',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    this.guardandoPostproduccion = true;
    this.proyectoService.actualizarPostproduccion(proyectoId, cambios)
      .pipe(finalize(() => { this.guardandoPostproduccion = false; }))
      .subscribe({
        next: () => {
          this.postproduccionOriginal = { ...this.postproduccion };
          this.refrescarProyectoDetalle();
          void Swal.fire({
            icon: 'success',
            title: titulo,
            text: texto,
            timer: 1400,
            showConfirmButton: false
          });
        },
        error: (err) => {
          console.error('[postproduccion] guardar', err);
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo guardar',
            text: 'Intenta nuevamente.',
            confirmButtonText: 'Entendido'
          });
        }
      });
  }

  get puedeEditarPreEntregaPost(): boolean {
    return !this.postproduccionSoloLecturaPorEstado
      && !!this.postproduccion.fechaInicioEdicion
      && !this.postproduccion.preEntregaFecha
      && !this.postproduccion.fechaFinEdicion;
  }

  get puedeCerrarEdicionPost(): boolean {
    return !this.postproduccionSoloLecturaPorEstado
      && !!this.postproduccion.fechaInicioEdicion
      && !!this.postproduccion.preEntregaFecha
      && !this.postproduccionOriginal.fechaFinEdicion;
  }

  get puedeEditarEntregaFinalPost(): boolean {
    return !this.postproduccionSoloLecturaPorEstado && !!this.postproduccion.fechaFinEdicion;
  }

  get puedeIniciarEdicionPost(): boolean {
    return !this.postproduccionSoloLecturaPorEstado && !this.postproduccionOriginal.fechaInicioEdicion;
  }

  get postproduccionSoloLecturaPorEstado(): boolean {
    const estado = this.getEstadoProyectoNormalizado();
    return estado === 'entregado' || estado === 'cerrado' || estado === 'cancelado';
  }

  get fechaMinEntregaFinalPost(): string | null {
    return this.toIsoDateOnly(this.postproduccion.fechaFinEdicion);
  }

  private cargarDevolucionDraft(diaId: number): void {
    const equipos = (this.detalle?.equiposDia ?? []).filter(item => item.diaId === diaId);
    const draft: Record<number, { estado: ProyectoEstadoDevolucion | ''; notas: string; fecha: string | null }> = {};
    equipos.forEach(eq => {
      const estadoRaw = (eq.estadoDevolucion ?? '').toString().trim().toUpperCase();
      const estado =
        estadoRaw === 'DEVUELTO' || estadoRaw === 'DANADO' || estadoRaw === 'PERDIDO' || estadoRaw === 'ROBADO'
          ? (estadoRaw as ProyectoEstadoDevolucion)
          : 'DEVUELTO';
      draft[eq.equipoId] = {
        estado,
        notas: eq.notasDevolucion ?? '',
        fecha: this.toDateTimeLocalValue(eq.fechaDevolucion) ?? this.toDateTimeLocalValue(new Date().toISOString())
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
    const items = (this.detalle?.equiposDia ?? []).filter(item => item.diaId === diaId);
    if (!this.mostrarSoloExcepcionesDevolucion) return items;
    return items.filter(item => this.getEstadoDevolucionActual(item.equipoId) !== 'DEVUELTO');
  }

  isDiaPendienteDevolucion(diaId: number): boolean {
    const items = (this.detalle?.equiposDia ?? []).filter(item => item.diaId === diaId);
    if (!items.length) return false;
    return items.some(item => this.normalizarEstadoDevolucion(item.estadoDevolucion) === 'PENDIENTE');
  }

  getDiasDevolucionPendientes(): ProyectoDia[] {
    return this.diasOrdenadosCache.filter(dia => {
      const tieneEquipos = (this.detalle?.equiposDia ?? []).some(eq => eq.diaId === dia.diaId);
      return this.isDiaFinalizado(dia.diaId) && this.isDiaPendienteDevolucion(dia.diaId) && tieneEquipos;
    });
  }

  toggleSoloExcepcionesEstado(): void {
    this.mostrarSoloExcepcionesEstado = !this.mostrarSoloExcepcionesEstado;
  }

  getResumenEstadoDia(diaId: number): { total: number; devueltos: number; excepciones: number } {
    const items = this.getEquiposEstadoPorDia(diaId);
    const total = items.length;
    const devueltos = items.filter(item => this.normalizarEstadoDevolucion(item.estadoDevolucion) === 'DEVUELTO').length;
    return { total, devueltos, excepciones: Math.max(total - devueltos, 0) };
  }

  getEquiposEstadoPorDia(diaId: number): EquipoDia[] {
    return (this.detalle?.equiposDia ?? [])
      .filter(item => item.diaId === diaId)
      .sort((a, b) => {
        const ra = (a.responsableNombre ?? 'Sin responsable').toString();
        const rb = (b.responsableNombre ?? 'Sin responsable').toString();
        const byResp = ra.localeCompare(rb);
        if (byResp !== 0) return byResp;
        return `${a.modelo ?? ''}${a.equipoSerie ?? ''}`.localeCompare(`${b.modelo ?? ''}${b.equipoSerie ?? ''}`);
      });
  }

  getGruposEstadoDia(diaId: number): { responsable: string; items: EquipoDia[]; total: number; devueltos: number; excepciones: number }[] {
    const source = this.getEquiposEstadoPorDia(diaId);
    const map = new Map<string, EquipoDia[]>();
    source.forEach(item => {
      const key = (item.responsableNombre ?? 'Sin responsable').toString().trim() || 'Sin responsable';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    const grupos = Array.from(map.entries()).map(([responsable, items]) => {
      const visibles = this.mostrarSoloExcepcionesEstado
        ? items.filter(item => this.normalizarEstadoDevolucion(item.estadoDevolucion) !== 'DEVUELTO')
        : items;
      const total = items.length;
      const devueltos = items.filter(item => this.normalizarEstadoDevolucion(item.estadoDevolucion) === 'DEVUELTO').length;
      return {
        responsable,
        items: visibles,
        total,
        devueltos,
        excepciones: Math.max(total - devueltos, 0)
      };
    });

    return grupos
      .filter(grupo => !this.mostrarSoloExcepcionesEstado || grupo.excepciones > 0)
      .sort((a, b) => a.responsable.localeCompare(b.responsable));
  }

  getEstadoDevolucionDisplay(estado: string | null | undefined): string {
    const normalized = this.normalizarEstadoDevolucion(estado);
    if (normalized === 'DEVUELTO') return 'Devuelto';
    if (normalized === 'DANADO') return 'Dañado';
    if (normalized === 'PERDIDO') return 'Perdido';
    if (normalized === 'ROBADO') return 'Robado';
    return 'Pendiente';
  }

  getEstadoDevolucionClass(estado: string | null | undefined): string {
    const normalized = this.normalizarEstadoDevolucion(estado);
    if (normalized === 'DEVUELTO') return 'estado-equipo-row--ok';
    if (normalized === 'DANADO') return 'estado-equipo-row--warn';
    if (normalized === 'PERDIDO' || normalized === 'ROBADO') return 'estado-equipo-row--danger';
    return 'estado-equipo-row--pending';
  }

  private normalizarEstadoDevolucion(estado: string | null | undefined): 'DEVUELTO' | 'DANADO' | 'PERDIDO' | 'ROBADO' | 'PENDIENTE' {
    const value = (estado ?? '').toString().trim().toUpperCase();
    if (value === 'DEVUELTO' || value === 'DANADO' || value === 'PERDIDO' || value === 'ROBADO') {
      return value;
    }
    return 'PENDIENTE';
  }

  getResponsablesDevolucionOptions(diaId: number | null): string[] {
    const set = new Set<string>();
    this.getEquiposDevolucionDia(diaId).forEach(item => {
      set.add((item.responsableNombre ?? 'Sin responsable').toString().trim() || 'Sin responsable');
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }

  getEquiposDevolucionFiltrados(diaId: number | null): typeof this.detalle.equiposDia {
    let items = this.getEquiposDevolucionDia(diaId);
    if (this.devolucionFiltroResponsable) {
      items = items.filter(item => (item.responsableNombre ?? 'Sin responsable') === this.devolucionFiltroResponsable);
    }
    const q = this.devolucionBusqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => {
      const target = `${item.modelo ?? ''} ${item.equipoSerie ?? ''} ${item.tipoEquipo ?? ''} ${item.responsableNombre ?? ''}`.toLowerCase();
      return target.includes(q);
    });
  }

  getGruposDevolucion(diaId: number | null): { key: string; responsable: string; items: (typeof this.detalle.equiposDia[number])[] }[] {
    const map = new Map<string, (typeof this.detalle.equiposDia[number])[]>();
    this.getEquiposDevolucionFiltrados(diaId).forEach(item => {
      const responsable = (item.responsableNombre ?? 'Sin responsable').toString().trim() || 'Sin responsable';
      if (!map.has(responsable)) {
        map.set(responsable, []);
      }
      map.get(responsable)!.push(item);
    });
    return Array.from(map.entries())
      .map(([responsable, items]) => ({
        key: responsable,
        responsable,
        items: [...items].sort((a, b) => `${a.modelo ?? ''}${a.equipoSerie ?? ''}`.localeCompare(`${b.modelo ?? ''}${b.equipoSerie ?? ''}`))
      }))
      .sort((a, b) => a.responsable.localeCompare(b.responsable));
  }

  isGrupoDevolucionAbierto(key: string): boolean {
    if (this.devolucionGruposAbiertos[key] !== undefined) return this.devolucionGruposAbiertos[key];
    return true;
  }

  onToggleGrupoDevolucion(key: string, event: Event): void {
    const target = event.target as HTMLDetailsElement | null;
    if (!target) return;
    this.devolucionGruposAbiertos[key] = target.open;
  }

  getResumenGrupoDevolucion(items: (typeof this.detalle.equiposDia[number])[]): { total: number; excepciones: number } {
    const total = items.length;
    let excepciones = 0;
    items.forEach(item => {
      if (this.getEstadoDevolucionActual(item.equipoId) !== 'DEVUELTO') {
        excepciones += 1;
      }
    });
    return { total, excepciones };
  }

  marcarGrupoDevuelto(items: (typeof this.detalle.equiposDia[number])[]): void {
    const nowIso = new Date().toISOString().slice(0, 16);
    items.forEach(item => {
      this.devolucionDraft[item.equipoId] = {
        estado: 'DEVUELTO',
        notas: this.devolucionDraft[item.equipoId]?.notas ?? '',
        fecha: this.devolucionDraft[item.equipoId]?.fecha ?? nowIso
      };
    });
    this.devolucionDraft = { ...this.devolucionDraft };
  }

  getEstadoDevolucionActual(equipoId: number): ProyectoEstadoDevolucion | '' {
    const estado = this.devolucionDraft[equipoId]?.estado ?? '';
    return estado;
  }

  getResumenDevolucionDia(diaId: number | null): { total: number; devueltos: number; excepciones: number } {
    const items = (this.detalle?.equiposDia ?? []).filter(item => diaId && item.diaId === diaId);
    const total = items.length;
    let devueltos = 0;
    items.forEach(item => {
      if (this.getEstadoDevolucionActual(item.equipoId) === 'DEVUELTO') {
        devueltos += 1;
      }
    });
    return { total, devueltos, excepciones: Math.max(total - devueltos, 0) };
  }

  toggleSoloExcepcionesDevolucion(): void {
    this.mostrarSoloExcepcionesDevolucion = !this.mostrarSoloExcepcionesDevolucion;
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
          notasDevolucion: (draft?.notas ?? '').trim()
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
    if (!this.isDiaFinalizado(this.devolucionDiaId)) return false;
    if (!this.isDiaPendienteDevolucion(this.devolucionDiaId)) return false;
    const equipos = this.getEquiposDevolucionDia(this.devolucionDiaId);
    const cambios = equipos.filter(eq => this.isDevolucionChanged(eq));
    if (!cambios.length) return false;
    const validEstados: ProyectoEstadoDevolucion[] = ['DEVUELTO', 'DANADO', 'PERDIDO', 'ROBADO'];
    return cambios.every(eq => {
      const draft = this.devolucionDraft[eq.equipoId];
      if (!draft?.estado) return false;
      if (!validEstados.includes(draft.estado)) return false;
      if (draft.estado === 'DEVUELTO') return true;
      return !!(draft.notas ?? '').trim();
    });
  }

  guardarDevoluciones(): void {
    if (!this.devolucionDiaId || !this.canGuardarDevoluciones()) return;
    const payload = this.buildDevolucionPayload();
    if (!payload.equipos.length) return;
    const fechaDia = this.toIsoDateOnly(
      (this.detalle?.dias ?? []).find(dia => dia.diaId === this.devolucionDiaId)?.fecha
    ) ?? this.getTodayIsoLocal();
    const equiposPreview = payload.equipos
      .filter(item => !!item.estadoDevolucion && item.estadoDevolucion !== 'DEVUELTO')
      .map(item => ({
        equipoId: item.equipoId,
        estadoDevolucion: item.estadoDevolucion!,
        diaId: this.devolucionDiaId!
      }));

    if (!equiposPreview.length) {
      const totalCambios = payload.equipos.length;
      void Swal.fire({
        icon: 'warning',
        title: '¿Confirmar devoluciones?',
        html: `
          <div style="text-align:left;display:grid;gap:8px;">
            <p>Se registrarán <strong>${totalCambios}</strong> equipo(s) como <strong>Devuelto</strong> para este día.</p>
            <p>Esta acción solo se puede registrar una vez. ¿Deseas continuar?</p>
          </div>
        `,
        width: '920px',
        showCancelButton: true,
        confirmButtonText: 'Sí, registrar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
      }).then(result => {
        if (!result.isConfirmed) return;
        this.iniciarRegistroDevolucionesAsync(payload);
      });
      return;
    }

    const requestPreview = {
      fechaBase: fechaDia,
      equipos: equiposPreview.map(item => ({
        equipoId: item.equipoId,
        estadoDevolucion: item.estadoDevolucion,
        diaId: item.diaId
      }))
    };

    this.guardandoDevolucion = true;
    this.proyectoService.previewDevolucionEquipos(requestPreview)
      .pipe(finalize(() => { this.guardandoDevolucion = false; }))
      .subscribe({
        next: (resultadoPreview: ProyectoDevolucionPreviewResponse) => {
          const simulaciones = resultadoPreview.simulaciones ?? (resultadoPreview.simulacion ? [resultadoPreview.simulacion] : []);
          const proyectosMap = new Map<number, {
            proyectoNombre: string;
            dias: Set<string>;
            equipos: Set<string>;
            equiposPorDia: Map<string, Set<string>>;
          }>();
          const equiposPorTipo = new Map<string, typeof simulaciones>();
          simulaciones.forEach(simulacion => {
            const tipo = (simulacion.equipo.tipoEquipoNombre || 'Sin tipo').toString();
            const items = equiposPorTipo.get(tipo) ?? [];
            items.push(simulacion);
            equiposPorTipo.set(tipo, items);
          });
          const equiposItemsHtml = Array.from(equiposPorTipo.entries()).map(([tipo, items]) => `
            <div style="display:grid;gap:8px;">
              <div style="font-size:12px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.02em;">
                ${tipo} (${items.length})
              </div>
              ${items.map(simulacion => `
                <div style="padding:12px;border:1px solid #dbe5f0;border-radius:10px;background:#ffffff;box-shadow:0 1px 1px rgba(15,23,42,0.03);display:grid;gap:6px;">
                  <div style="font-size:13px;font-weight:700;color:#0f172a;">${simulacion.equipo.modeloNombre || 'Equipo'} (${simulacion.equipo.serie || '—'})</div>
                  <div style="font-size:12px;color:#334155;">Estado devolución (día): <strong>${simulacion.estadoDevolucion === 'DEVUELTO' ? 'Devuelto' : simulacion.estadoDevolucion === 'DANADO' ? 'Dañado' : simulacion.estadoDevolucion === 'PERDIDO' ? 'Perdido' : simulacion.estadoDevolucion === 'ROBADO' ? 'Robado' : simulacion.estadoDevolucion}</strong></div>
                  <div style="font-size:12px;color:#334155;">Estado real del equipo: <strong>${(simulacion.estadoEquipoObjetivo || '—').toString().replace('En Mantenimiento', 'En mantenimiento').replace('De baja', 'De baja').replace('Disponible', 'Disponible')}</strong></div>
                </div>
              `).join('')}
            </div>
          `).join('');

          simulaciones.forEach(simulacion => {
            const equipoLabel = `${simulacion.equipo.tipoEquipoNombre || 'Equipo'} · ${simulacion.equipo.modeloNombre || '—'} (${simulacion.equipo.serie || '—'})`;
            simulacion.proyectosAfectados.forEach(proyecto => {
              const actual = proyectosMap.get(proyecto.proyectoId) ?? {
                proyectoNombre: proyecto.proyectoNombre,
                dias: new Set<string>(),
                equipos: new Set<string>(),
                equiposPorDia: new Map<string, Set<string>>()
              };
              actual.equipos.add(equipoLabel);
              proyectosMap.set(proyecto.proyectoId, actual);
            });
            simulacion.diasAfectados.forEach(dia => {
              const actual = proyectosMap.get(dia.proyectoId) ?? {
                proyectoNombre: dia.proyectoNombre,
                dias: new Set<string>(),
                equipos: new Set<string>(),
                equiposPorDia: new Map<string, Set<string>>()
              };
              actual.dias.add(dia.fecha);
              actual.equipos.add(equipoLabel);
              const equiposDia = actual.equiposPorDia.get(dia.fecha) ?? new Set<string>();
              equiposDia.add(equipoLabel);
              actual.equiposPorDia.set(dia.fecha, equiposDia);
              proyectosMap.set(dia.proyectoId, actual);
            });
          });

          const proyectoActualId = this.proyecto?.proyectoId ?? null;
          const proyectosOrdenados = Array.from(proyectosMap.entries())
            .map(([proyectoId, data]) => {
              const fechas = Array.from(data.dias).sort().map(fecha => this.formatFechaLarga(fecha));
              const diasAfectados = fechas.length;
              return {
                proyectoId,
                proyectoNombre: data.proyectoNombre,
                fechas,
                diasAfectados,
                equipos: Array.from(data.equipos).sort(),
                equiposPorDia: data.equiposPorDia,
                esProyectoActual: proyectoActualId !== null && proyectoId === proyectoActualId
              };
            })
            .sort((a, b) => {
              if (a.esProyectoActual && !b.esProyectoActual) return -1;
              if (!a.esProyectoActual && b.esProyectoActual) return 1;
              return b.diasAfectados - a.diasAfectados;
            });

          const proyectosItemsHtml = proyectosOrdenados.map(data => {
            const colorFondo = data.esProyectoActual ? '#fff7ed' : '#ffffff';
            const colorBorde = data.esProyectoActual ? '#fb923c' : '#e5e7eb';
            const badgeActual = data.esProyectoActual
              ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fed7aa;color:#9a3412;font-size:11px;font-weight:700;">Este proyecto</span>'
              : '';
            const diasConEquiposHtml = data.equiposPorDia.size
              ? Array.from(data.equiposPorDia.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([rawFecha, equiposSet]) => {
                const fechaLarga = this.formatFechaLarga(rawFecha);
                const equiposDia = Array.from(equiposSet).sort();
                return `
                  <li style="margin:3px 0;">
                    <strong>${fechaLarga}</strong><br/>
                    <span style="font-size:12px;color:#334155;">${equiposDia.length ? equiposDia.join(' · ') : 'Sin detalle de equipos'}</span>
                  </li>
                `;
              }).join('')
              : '<li style="margin:2px 0;">No se detectaron días en agenda</li>';
            return `
              <div style="padding:12px;border:1px solid ${colorBorde};border-radius:10px;background:${colorFondo};box-shadow:0 1px 1px rgba(15,23,42,0.03);">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
                  <strong style="color:#0f172a;">${data.proyectoNombre}</strong>
                  ${badgeActual}
                </div>
                <div style="display:grid;gap:6px;">
                  <div style="font-size:12px;color:#334155;">Uso en <strong>${data.diasAfectados}</strong> día(s)</div>
                  <div style="font-size:12px;color:#334155;">
                    Fechas afectadas:
                    <ul style="margin:4px 0 0 16px;padding:0;">
                      ${diasConEquiposHtml}
                    </ul>
                  </div>
                </div>
              </div>
            `;
          }).join('');

          const resumenTotales = resultadoPreview.resumen;
          const resumenHtml = `
            <div style="text-align:left;display:grid;gap:12px;">
              <div style="padding:12px;border:1px solid #dbe5f0;border-radius:12px;background:linear-gradient(180deg,#f8fbff 0%,#f3f7fc 100%);">
                <div style="font-weight:700;color:#0f172a;margin-bottom:10px;">Resumen de impacto</div>
                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
                  <div style="padding:8px;border-radius:10px;background:#ffffff;border:1px solid #e2e8f0;">
                    <div style="font-size:11px;color:#64748b;">Equipos evaluados</div>
                    <div style="font-size:18px;font-weight:700;color:#0f172a;">${resumenTotales?.cantidadEquipos ?? simulaciones.length}</div>
                  </div>
                  <div style="padding:8px;border-radius:10px;background:#ffffff;border:1px solid #e2e8f0;">
                    <div style="font-size:11px;color:#64748b;">Proyectos afectados</div>
                    <div style="font-size:18px;font-weight:700;color:#0f172a;">${resumenTotales?.proyectosAfectadosUnicos ?? proyectosOrdenados.length}</div>
                  </div>
                  <div style="padding:8px;border-radius:10px;background:#ffffff;border:1px solid #e2e8f0;">
                    <div style="font-size:11px;color:#64748b;">Días afectados</div>
                    <div style="font-size:18px;font-weight:700;color:#0f172a;">${resumenTotales?.diasAfectadosUnicos ?? 0}</div>
                  </div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:12px;">
                <div style="display:grid;gap:8px;align-content:start;">
                  <div style="font-weight:700;color:#0f172a;">Equipo que estás actualizando</div>
                  ${equiposItemsHtml || '<div style="color:#64748b;">Sin equipos para simular</div>'}
                </div>
                <div style="display:grid;gap:8px;align-content:start;">
                  <div style="font-weight:700;color:#0f172a;">Proyectos que se verían afectados</div>
                  ${proyectosItemsHtml || '<div style="color:#64748b;">No se detectó impacto en proyectos posteriores.</div>'}
                </div>
              </div>
              <div style="font-size:12px;color:#475569;padding:8px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
                Estos cambios pueden afectar la agenda futura. Revisa los proyectos marcados y confirma solo si estás seguro.
              </div>
            </div>
          `;

          void Swal.fire({
            icon: 'warning',
            title: '¿Confirmar devoluciones?',
            html: resumenHtml,
            width: '920px',
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true
          }).then(result => {
            if (!result.isConfirmed) return;
            this.iniciarRegistroDevolucionesAsync(payload);
          });
        },
        error: err => {
          console.error('[proyecto] devolucion preview', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo simular',
            text: err?.error?.message || 'No fue posible calcular el impacto de la devolución.'
          });
        }
      });
  }

  private iniciarRegistroDevolucionesAsync(payload: ProyectoDevolucionEquiposPayload): void {
    if (!this.devolucionDiaId) return;
    if (this.devolucionAsyncPollingTimer !== null) {
      clearTimeout(this.devolucionAsyncPollingTimer);
      this.devolucionAsyncPollingTimer = null;
    }
    this.guardandoDevolucion = true;
    void Swal.fire({
      title: 'Procesando devolución…',
      text: 'Estamos registrando los cambios. Esto puede tardar unos segundos.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.proyectoService.iniciarRegistroDevolucionesDiaAsync(this.devolucionDiaId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inicio) => {
          this.consultarEstadoRegistroDevolucionesAsync(inicio.jobId);
        },
        error: (err) => {
          this.guardandoDevolucion = false;
          if (this.devolucionAsyncPollingTimer !== null) {
            clearTimeout(this.devolucionAsyncPollingTimer);
            this.devolucionAsyncPollingTimer = null;
          }
          void Swal.close();
          console.error('[proyecto] devoluciones async start', err);
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo iniciar',
            text: err?.error?.message || 'No fue posible iniciar el registro de devoluciones.'
          });
        }
      });
  }

  private consultarEstadoRegistroDevolucionesAsync(jobId: string): void {
    this.proyectoService.consultarRegistroDevolucionesDiaAsync(jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (estadoJob: ProyectoDevolucionAsyncJobStatusResponse) => {
          if (estadoJob.estado === 'PENDIENTE' || estadoJob.estado === 'PROCESANDO') {
            if (this.devolucionAsyncPollingTimer !== null) {
              clearTimeout(this.devolucionAsyncPollingTimer);
            }
            this.devolucionAsyncPollingTimer = window.setTimeout(() => {
              this.consultarEstadoRegistroDevolucionesAsync(jobId);
            }, 1500);
            return;
          }

          if (this.devolucionAsyncPollingTimer !== null) {
            clearTimeout(this.devolucionAsyncPollingTimer);
            this.devolucionAsyncPollingTimer = null;
          }

          if (estadoJob.estado === 'ERROR') {
            this.guardandoDevolucion = false;
            void Swal.close();
            void Swal.fire({
              icon: 'error',
              title: 'No se pudo registrar',
              text: estadoJob.error || 'El proceso de devoluciones terminó con error.'
            });
            return;
          }

          this.guardandoDevolucion = false;
          void Swal.close();
          void Swal.fire({
            icon: 'success',
            title: 'Devoluciones registradas',
            timer: 1400,
            showConfirmButton: false
          });

          if (!this.proyecto?.proyectoId) return;
          this.proyectoService.getProyecto(this.proyecto.proyectoId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: data => {
                this.detalle = data;
                this.proyecto = data?.proyecto ?? null;
                this.rebuildDiaCaches();
                this.mostrarSoloExcepcionesDevolucion = false;
                this.cargarDevolucionDraft(this.devolucionDiaId!);
                this.cerrarModalDevolucion();
              },
              error: err => {
                console.error('[proyecto] devolucion refresh', err);
              }
            });
        },
        error: (err) => {
          this.guardandoDevolucion = false;
          if (this.devolucionAsyncPollingTimer !== null) {
            clearTimeout(this.devolucionAsyncPollingTimer);
            this.devolucionAsyncPollingTimer = null;
          }
          void Swal.close();
          console.error('[proyecto] devoluciones async poll', err);
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo consultar el proceso',
            text: err?.error?.message || 'Intenta nuevamente en unos segundos.'
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
      const dateTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
      if (dateTimeMatch) {
        const [, y, m, d] = dateTimeMatch;
        return `${d}-${m}-${y}`;
      }
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
    let parsed: Date;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const yyyy = Number(match[1]);
        const mm = Number(match[2]);
        const dd = Number(match[3]);
        parsed = new Date(Date.UTC(yyyy, mm - 1, dd));
      } else {
        parsed = new Date(trimmed);
      }
    } else {
      parsed = new Date(value);
    }
    if (isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat('es-PE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(parsed);
  }

  formatHora12(value: string | null | undefined): string {
    if (!value) return '—';
    const raw = String(value);
    let hours: number | null = null;
    let minutes: number | null = null;

    const timePart = (() => {
      if (raw.includes('T')) return raw.split('T')[1] ?? '';
      if (raw.includes(' ')) return raw.split(' ')[1] ?? '';
      if (/^\d{1,2}:\d{2}/.test(raw)) return raw;
      return '';
    })();

    if (timePart) {
      const match = timePart.match(/^(\d{1,2}):(\d{2})/);
      if (match) {
        hours = Number(match[1]);
        minutes = Number(match[2]);
      }
    }

    if (hours === null || minutes === null || Number.isNaN(hours) || Number.isNaN(minutes)) {
      const parsed = new Date(raw);
      if (isNaN(parsed.getTime())) return '—';
      hours = parsed.getHours();
      minutes = parsed.getMinutes();
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  }

  getEstadoDiaNombre(estadoDiaId: number | null): string | null {
    if (!estadoDiaId) return null;
    const estado = this.estadosDiaCatalogo.find(item => item.estadoDiaId === estadoDiaId);
    return estado?.estadoDiaNombre ?? null;
  }

  isDiaEnCurso(diaId: number | null): boolean {
    if (!diaId || !this.detalle?.dias?.length) return false;
    const dia = this.detalle.dias.find(d => d.diaId === diaId);
    return (dia?.estadoDiaNombre ?? '').toString().trim().toLowerCase() === 'en curso';
  }

  isDiaPendienteEstado(diaId: number | null): boolean {
    if (!diaId || !this.detalle?.dias?.length) return false;
    const dia = this.detalle.dias.find(d => d.diaId === diaId);
    return (dia?.estadoDiaNombre ?? '').toString().trim().toLowerCase() === 'pendiente';
  }

  isDiaFinalizado(diaId: number | null): boolean {
    if (!diaId || !this.detalle?.dias?.length) return false;
    const dia = this.detalle.dias.find(d => d.diaId === diaId);
    const estado = (dia?.estadoDiaNombre ?? '').toString().trim().toLowerCase();
    return estado === 'terminado' || estado === 'cancelado' || estado === 'cerrado' || estado === 'finalizado';
  }

  getEstadosDiaPermitidos(dia: ProyectoDia): ProyectoDiaEstadoItem[] {
    const actual = (dia.estadoDiaNombre ?? '').toString().trim().toLowerCase();
    const allowByState: Record<string, string[]> = {
      'pendiente': ['en curso', 'suspendido', 'cancelado'],
      'en curso': ['terminado', 'suspendido', 'cancelado'],
      'suspendido': ['en curso', 'cancelado'],
      'terminado': [],
      'cancelado': []
    };
    const allowed = allowByState[actual] ?? [];
    if (!allowed.length) return [];
    return this.estadosDiaCatalogo.filter(item =>
      allowed.includes((item.estadoDiaNombre ?? '').toString().trim().toLowerCase())
    );
  }

  private getConfirmacionEstadoDia(
    estadoActual: string,
    estadoNuevo: string
  ): { title: string; text: string; confirmText: string } | null {
    if (estadoActual === 'pendiente' && estadoNuevo === 'en curso') {
      return { title: '¿Iniciar día?', text: 'Esto marcará el día como En curso.', confirmText: 'Sí, iniciar' };
    }
    if (estadoActual === 'pendiente' && estadoNuevo === 'suspendido') {
      return { title: '¿Suspender día?', text: 'El día quedará en pausa y podrá reanudarse luego.', confirmText: 'Sí, suspender' };
    }
    if (estadoActual === 'pendiente' && estadoNuevo === 'cancelado') {
      return { title: '¿Cancelar día?', text: 'Esta acción es final y no se podrá reabrir.', confirmText: 'Sí, cancelar' };
    }
    if (estadoActual === 'en curso' && estadoNuevo === 'terminado') {
      return { title: '¿Terminar día?', text: 'Se marcará como Terminado y no podrá reabrirse.', confirmText: 'Sí, terminar' };
    }
    if (estadoActual === 'en curso' && estadoNuevo === 'suspendido') {
      return { title: '¿Suspender día en ejecución?', text: 'Podrás reanudarlo luego.', confirmText: 'Sí, suspender' };
    }
    if (estadoActual === 'en curso' && estadoNuevo === 'cancelado') {
      return { title: '¿Cancelar día en ejecución?', text: 'Esta acción es final y no se podrá reabrir.', confirmText: 'Sí, cancelar' };
    }
    if (estadoActual === 'suspendido' && estadoNuevo === 'en curso') {
      return { title: '¿Reanudar día?', text: 'El día volverá a En curso.', confirmText: 'Sí, reanudar' };
    }
    if (estadoActual === 'suspendido' && estadoNuevo === 'cancelado') {
      return { title: '¿Cancelar día suspendido?', text: 'Esta acción es final y no se podrá reabrir.', confirmText: 'Sí, cancelar' };
    }
    return null;
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

  get totalIncidencias(): number {
    return this.detalle?.incidenciasDia?.length ?? 0;
  }

  get totalDiasConPendientes(): number {
    return this.diasOrdenadosCache.filter(dia => {
      const p = this.getPendientesDia(dia.diaId);
      return p.personal > 0 || p.equipos > 0;
    }).length;
  }

  get totalEquiposPendientesDevolucion(): number {
    return (this.detalle?.equiposDia ?? []).filter(eq => {
      const estado = (eq.estadoDevolucion ?? '').toString().trim().toLowerCase();
      return !estado || estado === 'pendiente' || estado === 'sin devolución' || estado === 'sin devolucion';
    }).length;
  }

  get avanceAsignacionGeneral(): number {
    const resumenes = Array.from(this.diaResumenMap.values());
    const totalRequerido = resumenes.reduce((acc, item) => acc + item.reqPersonal + item.reqEquipos, 0);
    if (!totalRequerido) return 100;
    const totalAsignado = resumenes.reduce(
      (acc, item) => acc + Math.min(item.asignPersonal, item.reqPersonal) + Math.min(item.asignEquipos, item.reqEquipos),
      0
    );
    return Math.max(0, Math.min(100, Math.round((totalAsignado / totalRequerido) * 100)));
  }

  get totalDiasRiesgoAlto(): number {
    return this.diasOrdenadosCache.filter(dia => this.getNivelRiesgoDia(dia.diaId) === 'alto').length;
  }

  getNivelRiesgoDia(diaId: number): 'alto' | 'medio' | 'bajo' {
    const resumen = this.getDiaResumen(diaId);
    const pendientes = resumen.pendientesPersonal + resumen.pendientesEquipos;
    if (resumen.estadoAsignacion === 'Sin asignar' || pendientes >= 3) return 'alto';
    if (pendientes > 0 || resumen.incidenciasCount > 0) return 'medio';
    return 'bajo';
  }

  getRiesgoDiaLabel(diaId: number): string {
    const nivel = this.getNivelRiesgoDia(diaId);
    if (nivel === 'alto') return 'Riesgo alto';
    if (nivel === 'medio') return 'Riesgo medio';
    return 'Riesgo bajo';
  }

  getRiesgoGeneralClass(): 'control-kpi--danger' | 'control-kpi--warning' | 'control-kpi--neutral' {
    if (this.totalDiasRiesgoAlto > 0) return 'control-kpi--danger';
    if ((this.pendientesTotales.personal + this.pendientesTotales.equipos) > 0) return 'control-kpi--warning';
    return 'control-kpi--neutral';
  }

  get diasYaCanceladosCount(): number {
    return (this.detalle?.dias ?? []).filter(dia =>
      (dia.estadoDiaNombre ?? '').toString().trim().toLowerCase() === 'cancelado'
    ).length;
  }

  get diasNoCanceladosCount(): number {
    const total = this.detalle?.dias?.length ?? 0;
    return Math.max(total - this.diasYaCanceladosCount, 0);
  }

  get montoNcEstimadoGlobal(): number {
    const saldo = Number(this.proyecto?.saldoPendiente ?? 0);
    if (Number.isNaN(saldo)) return 0;
    return Math.max(0, saldo);
  }

  get saldoNetoEsCero(): boolean {
    const saldo = Number(this.proyecto?.saldoPendiente ?? 0);
    if (Number.isNaN(saldo)) return false;
    return saldo <= 0;
  }

  private getToastEstadoDiaTitle(estadoNuevo: string): string {
    if (estadoNuevo === 'en curso') return 'Día iniciado';
    if (estadoNuevo === 'terminado') return 'Día terminado';
    if (estadoNuevo === 'cancelado') return 'Día cancelado';
    if (estadoNuevo === 'suspendido') return 'Día suspendido';
    if (estadoNuevo === 'pendiente') return 'Día en pendiente';
    return 'Estado actualizado';
  }

  private getCancelacionMotivoLabel(responsable: CancelacionResponsable, motivo: string): string {
    const option = CANCELACION_MOTIVOS[responsable].find(item => item.value === motivo);
    return option?.label ?? motivo;
  }

  private getMensajeErrorCancelacion(err: any, global: boolean): string {
    const rawMessage = (err?.error?.message ?? err?.error?.status ?? '').toString().trim();
    const msg = rawMessage.toLowerCase();
    if (msg.includes('no válido') || msg.includes('no valido') || msg.includes('no existe') || msg.includes('inválido') || msg.includes('invalido')) {
      return global ? 'El proyecto no es válido o no existe.' : 'El día no es válido o no existe.';
    }
    if (msg.includes('ya cancelado') || msg.includes('ya se encuentra cancelado')) {
      return global ? 'El proyecto ya está cancelado.' : 'El día ya está cancelado.';
    }
    if (global && (msg.includes('terminado') || msg.includes('finalizado'))) {
      return 'Hay días terminados y no se permite la cancelación global.';
    }
    if (msg.includes('motivo') || msg.includes('nota') || msg.includes('validación') || msg.includes('validacion')) {
      return 'Revisa motivo y notas: hay un error de validación.';
    }
    return rawMessage || 'Intenta nuevamente.';
  }

  getDiaCancelacionResponsableLabel(dia: ProyectoDia): string {
    const raw = (dia.cancelResponsable ?? '').toString().trim().toUpperCase();
    if (raw === 'INTERNO') return 'Interno';
    if (raw === 'CLIENTE') return 'Cliente';
    return 'No registrado';
  }

  getDiaCancelacionMotivoLabel(dia: ProyectoDia): string {
    const responsableRaw = (dia.cancelResponsable ?? 'CLIENTE').toString().trim().toUpperCase();
    const responsable = (responsableRaw === 'INTERNO' ? 'INTERNO' : 'CLIENTE') as CancelacionResponsable;
    const motivo = (dia.cancelMotivo ?? '').toString().trim();
    if (!motivo) return 'No registrado';
    return this.getCancelacionMotivoLabel(responsable, motivo);
  }

  getDiaCancelacionNotas(dia: ProyectoDia): string {
    return (dia.cancelNotas ?? '').toString().trim();
  }

  getDiaCancelacionFecha(dia: ProyectoDia): string | null {
    const fecha = dia.cancelFecha ?? null;
    return fecha && String(fecha).trim() ? String(fecha) : null;
  }

  isDiaNcRequerida(dia: ProyectoDia): boolean {
    return Number(dia.ncRequerida ?? null) === 1;
  }

  getDiaVoucherId(dia: ProyectoDia): number | null {
    const raw = dia.ncVoucherId ?? null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  private async pedirContextoCancelacionDia(dia: ProyectoDia): Promise<CancelacionDiaContexto | null> {
    const toOptionsHtml = (options: CancelacionMotivoOption[]): string =>
      options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Antes de cancelar este día',
      html: `
        <div style="text-align:left;display:grid;gap:10px;">
          <p style="margin:0;color:#475569;font-size:13px;">
            Día: <strong>${this.formatFechaLarga(dia.fecha)}</strong>
          </p>
          <label style="font-size:13px;font-weight:600;color:#0f172a;">Responsable de la cancelación</label>
          <select id="cancelacionResponsable" class="swal2-select" style="width:100%;margin:0;">
            <option value="CLIENTE">Cliente</option>
            <option value="INTERNO">Interno (nosotros)</option>
          </select>
          <label style="font-size:13px;font-weight:600;color:#0f172a;">Motivo</label>
          <select id="cancelacionMotivo" class="swal2-select" style="width:100%;margin:0;">
            ${toOptionsHtml(CANCELACION_MOTIVOS.CLIENTE)}
          </select>
          <label style="font-size:13px;font-weight:600;color:#0f172a;">Notas (opcional)</label>
          <textarea id="cancelacionNotas" class="swal2-textarea" style="width:100%;margin:0;" maxlength="500" placeholder="Detalle adicional para auditoría interna."></textarea>
          <small id="cancelacionHint" style="color:#64748b;">
            Si la cancelación es interna, luego podrás gestionar nota de crédito en cobros.
          </small>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      didOpen: () => {
        const responsableEl = document.getElementById('cancelacionResponsable') as HTMLSelectElement | null;
        const motivoEl = document.getElementById('cancelacionMotivo') as HTMLSelectElement | null;
        const notasEl = document.getElementById('cancelacionNotas') as HTMLTextAreaElement | null;
        const hintEl = document.getElementById('cancelacionHint') as HTMLElement | null;
        if (!responsableEl || !motivoEl || !notasEl) return;

        const refreshMotivos = () => {
          const responsable = (responsableEl.value === 'INTERNO' ? 'INTERNO' : 'CLIENTE') as CancelacionResponsable;
          motivoEl.innerHTML = toOptionsHtml(CANCELACION_MOTIVOS[responsable]);
          if (hintEl) {
            hintEl.textContent = responsable === 'INTERNO'
              ? 'Esta cancelación interna puede requerir nota de crédito.'
              : 'Esta cancelación por cliente no requiere nota de crédito.';
          }
          if (responsable === 'INTERNO' && !notasEl.value.trim()) {
            notasEl.placeholder = 'Explica brevemente el contexto interno de la cancelación.';
          } else {
            notasEl.placeholder = 'Detalle adicional para auditoría interna.';
          }
        };

        responsableEl.addEventListener('change', refreshMotivos);
        refreshMotivos();
      },
      preConfirm: () => {
        const responsableEl = document.getElementById('cancelacionResponsable') as HTMLSelectElement | null;
        const motivoEl = document.getElementById('cancelacionMotivo') as HTMLSelectElement | null;
        const notasEl = document.getElementById('cancelacionNotas') as HTMLTextAreaElement | null;

        const responsable = (responsableEl?.value === 'INTERNO' ? 'INTERNO' : 'CLIENTE') as CancelacionResponsable;
        const motivo = (motivoEl?.value ?? '').toString().trim();
        const notas = (notasEl?.value ?? '').toString().trim();

        if (!motivo) {
          Swal.showValidationMessage('Selecciona un motivo de cancelación.');
          return null;
        }
        if ((motivo === 'OTRO_CLIENTE' || motivo === 'OTRO_INTERNO') && notas.length < 8) {
          Swal.showValidationMessage('Cuando eliges "Otro", agrega al menos 8 caracteres en notas.');
          return null;
        }

        return {
          responsable,
          motivo,
          notas
        } as CancelacionDiaContexto;
      }
    });

    return result.isConfirmed ? (result.value as CancelacionDiaContexto) : null;
  }

  getAsignacionDiaLabel(): string {
    if (!this.asignacionDiaId) return '—';
    const dia = this.detalle?.dias?.find(d => d.diaId === this.asignacionDiaId);
    return this.formatFechaLarga(dia?.fecha ?? '');
  }

  getIncidenciaDiaLabel(): string {
    if (!this.incidenciaDiaId) return '—';
    const dia = this.detalle?.dias?.find(d => d.diaId === this.incidenciaDiaId);
    return this.formatFechaLarga(dia?.fecha ?? '');
  }

  canGuardarAsignacionesFinal(): boolean {
    if (this.asignacionSoloLectura) return false;
    if (!this.asignacionDiaId) return false;
    if (!this.hasRequerimientosDia(this.asignacionDiaId)) return false;
    if (!this.isAsignacionDiaDirty(this.asignacionDiaId)) return false;
    if (!this.asignacionEmpleados.length) return false;
    return this.asignacionEmpleados.every(emp => this.getEquiposCountResponsable(emp.empleadoId) > 0);
  }

  getResponsablesSinEquipoCount(): number {
    if (!this.asignacionEmpleados.length) return 0;
    return this.asignacionEmpleados
      .filter(emp => this.getEquiposCountResponsable(emp.empleadoId) === 0)
      .length;
  }

  canCompletarPasoPersonal(): boolean {
    return this.asignacionEmpleados.length > 0;
  }

  canCompletarPasoEquipos(): boolean {
    return this.asignacionEquipos.length > 0;
  }

  canCompletarPasoResponsables(): boolean {
    return this.getResponsablesSinEquipoCount() === 0 && this.asignacionEmpleados.length > 0;
  }

  canIrAnteriorAsignaciones(): boolean {
    const idx = this.asignacionesStepper?.selectedIndex ?? 0;
    return !!this.asignacionDiaId && idx > 0;
  }

  canIrSiguienteAsignaciones(): boolean {
    const idx = this.asignacionesStepper?.selectedIndex ?? 0;
    if (!this.asignacionDiaId || idx >= 2) return false;
    if (idx === 0) return this.canCompletarPasoPersonal();
    if (idx === 1) return this.canCompletarPasoEquipos();
    return false;
  }

  esUltimoPasoAsignaciones(): boolean {
    return (this.asignacionesStepper?.selectedIndex ?? 0) === 2;
  }

  asignacionesAnterior(): void {
    this.asignacionesStepper?.previous();
  }

  asignacionesSiguiente(): void {
    this.asignacionesStepper?.next();
  }

  toggleSoloPendientes(): void {
    this.soloPendientes = !this.soloPendientes;
    const dias = [...this.diasOrdenadosCache];
    const filtrados = this.soloPendientes
      ? dias.filter(d => (d.estadoDiaNombre ?? '').toString().trim().toLowerCase() === 'pendiente')
      : dias;
    this.openDiaId = filtrados[0]?.diaId ?? null;
  }

  irAPrimerPendiente(): void {
    const pendiente = this.diasOrdenadosCache.find(d => {
      const p = this.getPendientesDia(d.diaId);
      return p.personal > 0 || p.equipos > 0;
    });
    if (!pendiente) return;
    this.soloPendientes = true;
    this.openDiaId = pendiente.diaId;
    this.irASeccion('agenda-proyecto');
  }

  getOpenDiaLabel(): string {
    if (!this.openDiaId) return 'Día seleccionado';
    const dia = this.diasOrdenadosCache.find(item => item.diaId === this.openDiaId);
    return dia ? this.formatFechaLarga(dia.fecha) : 'Día seleccionado';
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

  get fechaMinInicioEdicion(): string | null {
    const ultimaFechaTrabajo = this.diasOrdenadosCache[this.diasOrdenadosCache.length - 1]?.fecha;
    return this.toIsoDateOnly(ultimaFechaTrabajo);
  }

  get fechaMinFinEdicion(): string | null {
    return this.toIsoDateOnly(this.postproduccion.fechaInicioEdicion);
  }

  get mostrarAccionesAgendaPendientes(): boolean {
    const estado = this.getEstadoProyectoNormalizado();
    return estado !== 'entregado' && estado !== 'listo para entrega';
  }

  private refrescarProyectoDetalle(): void {
    const proyectoId = this.proyecto?.proyectoId;
    if (!proyectoId) return;
    this.proyectoService.getProyecto(proyectoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.detalle = data;
          this.proyecto = data?.proyecto ?? null;
          this.rebuildDiaCaches();
        },
        error: err => {
          console.error('[proyecto] refrescar detalle', err);
        }
      });
  }

  private updateStepperOrientation(): void {
    if (typeof window === 'undefined') return;
    this.stepperOrientation = window.innerWidth < 900 ? 'vertical' : 'horizontal';
  }

  private getEstadoProyectoNormalizado(): string {
    return (this.proyecto?.estadoNombre ?? '').toString().trim().toLowerCase();
  }

  private toIsoDateOnly(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (isNaN(parsed.getTime())) return null;
    const yyyy = parsed.getUTCFullYear();
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
        fechaHoraEvento: row.fechaHoraEvento ?? null,
        createdAt: row.createdAt,
        empleadoNombre: row.empleadoNombre ?? null,
        empleadoCargo: row.empleadoCargo ?? null,
        empleadoReemplazoNombre: row.empleadoReemplazoNombre ?? null,
        empleadoReemplazoCargo: row.empleadoReemplazoCargo ?? null
      });
    });
    this.incidenciasDiaMap.forEach((rows, diaId) => {
      this.incidenciasDiaMap.set(
        diaId,
        [...rows].sort((a, b) => String(b.fechaHoraEvento ?? b.createdAt).localeCompare(String(a.fechaHoraEvento ?? a.createdAt)))
      );
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
          estadoAsignacion = 'Asignaciones completas';
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

  private toDateTimeLocalValue(value: string | null | undefined): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  private getTodayIsoLocal(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private setIncidenciaHoraActual(): void {
    const now = new Date();
    const hours24 = now.getHours();
    const h12 = hours24 % 12 || 12;
    const roundedMin = Math.round(now.getMinutes() / 5) * 5;
    this.incidenciaHora12 = String(h12).padStart(2, '0');
    this.incidenciaMinuto = String(roundedMin >= 60 ? 55 : roundedMin).padStart(2, '0');
    this.incidenciaAmPm = hours24 >= 12 ? 'PM' : 'AM';
  }


}





