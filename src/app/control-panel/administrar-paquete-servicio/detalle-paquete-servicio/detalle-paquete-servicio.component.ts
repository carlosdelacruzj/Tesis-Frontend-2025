import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { finalize, switchMap, takeUntil } from 'rxjs/operators';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import {
  Evento,
  EventoServicioCategoria,
  EventoServicioDetalle,
  EventoServicioEquipo,
  EstadoEventoServicio,
  EventoServicioStaff,
  Servicio
} from '../model/evento-servicio.model';
import { TipoEquipo } from '../../administrar-equipos/models/tipo-equipo.model';
import { EventoServicioDataService } from '../service/evento-servicio-data.service';
import { Cargo, PersonalService } from '../../gestionar-personal/service/personal.service';

@Component({
  selector: 'app-paquete-servicio-detalle',
  templateUrl: './detalle-paquete-servicio.component.html',
  styleUrls: ['./detalle-paquete-servicio.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetallePaqueteServicioComponent implements OnInit, OnDestroy {
  evento: Evento | null = null;
  paquetes: EventoServicioDetalle[] = [];
  selectedPaquete: EventoServicioDetalle | null = null;
  servicios: Servicio[] = [];
  tipoEquipos: TipoEquipo[] = [];
  categorias: EventoServicioCategoria[] = [];
  cargos: Cargo[] = [];
  estados: EstadoEventoServicio[] = [];
  searchTerm = '';

  loadingEvento = false;
  loadingPaquetes = false;
  totalPaquetes = 0;
  totalStaff = 0;

  modalOpen = false;
  modalSaving = false;
  modalError: string | null = null;
  modalModo: 'crear' | 'editar' = 'crear';
  paqueteEditando: EventoServicioDetalle | null = null;
  detalleModalAbierto = false;

  form = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    servicio: [null as number | null, Validators.required],
    categoriaId: [null as number | null, Validators.required],
    esAddon: [false],
    estadoId: [null as number | null],
    precio: [null as number | null, [Validators.required, Validators.min(1)]],
    descripcion: [''],
    horas: [null as number | null, [Validators.required, Validators.min(0)]],
    fotosImpresas: [null as number | null],
    trailerMin: [null as number | null],
    filmMin: [null as number | null],
    staff: this.fb.array([], Validators.minLength(1)),
    equipos: this.fb.array([], Validators.minLength(1))
  });

  columns: TableColumn<EventoServicioDetalle>[] = [
    { key: 'titulo', header: 'Título', sortable: true },
    { key: 'servicio.nombre', header: 'Servicio', sortable: true },
    { key: 'categoriaNombre', header: 'Categoría', sortable: true },
    { key: 'precio', header: 'Precio', sortable: true, class: 'text-end', width: '130px' },
    { key: 'horas', header: 'Horas', sortable: true, class: 'text-center', width: '90px' },
    { key: 'staff.total', header: 'Staff', sortable: true, class: 'text-center', width: '110px' },
    { key: 'estado.nombre', header: 'Estado', sortable: true, class: 'text-center', width: '120px' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, class: 'text-center', width: '120px' }
  ];

  get staffArray(): FormArray {
    return this.form.get('staff') as FormArray;
  }

  get equiposArray(): FormArray {
    return this.form.get('equipos') as FormArray;
  }

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dataService: EventoServicioDataService,
    private readonly cdr: ChangeDetectorRef,
    private readonly fb: FormBuilder,
    private readonly personalService: PersonalService
  ) {
    this.resetStaffForm();
    this.resetEquiposForm();
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const eventoId = Number(params.get('eventoId'));
        if (eventoId) {
          this.cargarEvento(eventoId);
          this.cargarPaquetes(eventoId);
          this.cargarServicios();
          this.cargarTiposEquipo();
          this.cargarEstados();
        } else {
          this.router.navigate(['/home/administrar-paquete-servicio']);
        }
      });
    this.cargarCategorias();
    this.cargarCargos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  regresarAlListado(): void {
    this.router.navigate(['/home/administrar-paquete-servicio']);
  }

  abrirModalCrear(): void {
    if (!this.evento?.id) return;
    this.modalModo = 'crear';
    this.modalError = null;
    this.paqueteEditando = null;
    this.form.reset({
      titulo: '',
      servicio: this.servicios.length === 1 ? this.servicios[0].id : null,
      categoriaId: this.categorias.length === 1 ? this.categorias[0].id : null,
      esAddon: false,
      estadoId: this.estados.length === 1 ? this.estados[0].idEstado : null,
      precio: null,
      descripcion: '',
      horas: null,
      fotosImpresas: null,
      trailerMin: null,
      filmMin: null
    });
    this.resetStaffForm();
    this.resetEquiposForm();
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalOpen = true;
  }

  abrirModalEditar(paquete: EventoServicioDetalle): void {
    this.modalModo = 'editar';
    this.modalError = null;
    this.paqueteEditando = paquete;
    this.form.reset({
      titulo: paquete.titulo,
      servicio: paquete.servicio?.id ?? null,
      categoriaId: paquete.categoriaId ?? null,
      esAddon: paquete.esAddon ?? false,
      estadoId: paquete.estado?.id ?? null,
      precio: paquete.precio,
      descripcion: paquete.descripcion,
      horas: paquete.horas,
      fotosImpresas: paquete.fotosImpresas,
      trailerMin: paquete.trailerMin,
      filmMin: paquete.filmMin
    });
    this.resetStaffForm(paquete.staff?.detalle ?? []);
    this.resetEquiposForm(paquete.equipos ?? []);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.modalOpen = true;
  }

  onToolbarSearch(term: string): void {
    this.searchTerm = term ?? '';
  }

  cerrarModal(): void {
    if (this.modalSaving) return;
    this.modalOpen = false;
    this.modalError = null;
    this.paqueteEditando = null;
  }

  abrirModalDetalle(paquete: EventoServicioDetalle): void {
    this.selectedPaquete = paquete;
    this.detalleModalAbierto = true;
    this.cdr.markForCheck();
  }

  cerrarModalDetalle(): void {
    this.detalleModalAbierto = false;
    this.selectedPaquete = null;
    this.cdr.markForCheck();
  }

  async guardarPaquete(): Promise<void> {
    if (this.form.invalid || !this.evento?.id) {
      this.form.markAllAsTouched();
      this.staffArray.markAllAsTouched();
      this.equiposArray.markAllAsTouched();
      return;
    }

    const staffPayload: EventoServicioStaff[] = this.staffArray.controls.map(control => {
      const value = control.value;
      return {
        rol: (value.cargo || '').trim(),
        cantidad: Number(value.cantidad) || 0
      };
    });

    const equiposPayload = this.equiposArray.controls.map(control => {
      const value = control.value;
      return {
        tipoEquipoId: Number(value.tipoEquipoId),
        cantidad: Number(value.cantidad) || 0,
        notas: value.notas?.trim() || null
      };
    });

    const payload = {
      servicio: this.form.value.servicio!,
      evento: this.evento.id,
      titulo: (this.form.value.titulo || '').trim(),
      categoriaId: this.form.value.categoriaId ?? null,
      esAddon: !!this.form.value.esAddon,
      precio: Number(this.form.value.precio),
      descripcion: this.form.value.descripcion?.trim() || null,
      horas: this.form.value.horas ?? null,
      fotosImpresas: this.form.value.fotosImpresas ?? null,
      trailerMin: this.form.value.trailerMin ?? null,
      filmMin: this.form.value.filmMin ?? null,
      staff: staffPayload,
      equipos: equiposPayload
    };

    const estadoSeleccionado = this.form.value.estadoId != null ? Number(this.form.value.estadoId) : null;
    const estadoOriginal = this.paqueteEditando?.estado?.id ?? null;
    const debeActualizarEstado = this.modalModo === 'editar' && estadoSeleccionado !== null && estadoSeleccionado !== estadoOriginal;
    const soloEstadoCambiado = this.modalModo === 'editar' && debeActualizarEstado && this.form.pristine;

    if (this.modalModo === 'editar') {
      const { isConfirmed } = await Swal.fire({
        icon: 'question',
        title: 'Confirmar actualización',
        text: '¿Deseas guardar los cambios?',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
      });
      if (!isConfirmed) {
        return;
      }
    }

    this.modalSaving = true;
    const request$ = this.modalModo === 'crear'
      ? this.dataService.crearEventoServicio(payload)
      : (soloEstadoCambiado
          ? this.dataService.actualizarEstadoEventoServicio(this.paqueteEditando!.id, estadoSeleccionado!)
          : this.dataService.actualizarEventoServicio(this.paqueteEditando!.id, payload).pipe(
              switchMap(() => debeActualizarEstado
                ? this.dataService.actualizarEstadoEventoServicio(this.paqueteEditando!.id, estadoSeleccionado!)
                : of(null))
            ));

    request$
      .pipe(finalize(() => {
        this.modalSaving = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: () => {
          void Swal.fire({
            icon: 'success',
            title: 'Guardado',
            text: this.modalModo === 'crear' ? 'Paquete registrado' : 'Cambios guardados',
            timer: 1800,
            showConfirmButton: false
          });
          this.modalOpen = false;
          this.paqueteEditando = null;
          this.cargarPaquetes(this.evento!.id);
        },
        error: (err) => {
          console.error('Error guardando paquete', err);
          this.modalError = 'No pudimos guardar el paquete. Intenta nuevamente.';
          void Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No pudimos guardar el paquete. Intenta nuevamente.'
          });
        }
      });
  }

  agregarStaff(): void {
    this.staffArray.push(this.crearStaffFormGroup());
    this.cdr.markForCheck();
  }

  eliminarStaff(index: number): void {
    if (this.staffArray.length <= 1) return;
    this.staffArray.removeAt(index);
    this.cdr.markForCheck();
  }

  agregarEquipo(): void {
    const nuevo = this.crearEquipoFormGroup();
    this.ensureTipoEquipoDefault(nuevo);
    this.equiposArray.push(nuevo);
    this.cdr.markForCheck();
  }

  eliminarEquipo(index: number): void {
    if (this.equiposArray.length <= 1) return;
    this.equiposArray.removeAt(index);
    this.cdr.markForCheck();
  }

  onTipoEquipoSeleccionado(index: number): void {
    const control = this.equiposArray.at(index) as FormGroup;
    this.syncEquipoNombre(control);
  }

  private cargarEvento(id: number): void {
    this.loadingEvento = true;
    this.dataService.getEventoPorId(id)
      .pipe(finalize(() => {
        this.loadingEvento = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (evento) => {
          this.evento = evento;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando evento', err);
          this.evento = null;
          this.cdr.markForCheck();
        }
      });
  }

  private crearStaffFormGroup(miembro?: EventoServicioStaff): FormGroup {
    return this.fb.group({
      cargo: [miembro?.rol ?? '', [Validators.required]],
      cantidad: [miembro?.cantidad ?? 1, [Validators.required, Validators.min(1)]]
    });
  }

  private crearEquipoFormGroup(equipo?: EventoServicioEquipo): FormGroup {
    return this.fb.group({
      tipoEquipoId: [equipo?.tipoEquipoId ?? null, [Validators.required, Validators.min(1)]],
      tipoEquipo: [equipo?.tipoEquipo ?? ''],
      cantidad: [equipo?.cantidad ?? 1, [Validators.required, Validators.min(1)]],
      notas: [equipo?.notas ?? '']
    });
  }

  private resetStaffForm(miembros?: EventoServicioStaff[]): void {
    const staffArray = this.staffArray;
    while (staffArray.length) {
      staffArray.removeAt(0);
    }
    if (miembros?.length) {
      miembros.forEach(miembro => staffArray.push(this.crearStaffFormGroup(miembro)));
    } else {
      staffArray.push(this.crearStaffFormGroup());
    }
    staffArray.markAsPristine();
    staffArray.markAsUntouched();
  }

  private resetEquiposForm(equipos?: EventoServicioEquipo[]): void {
    const equiposArray = this.equiposArray;
    while (equiposArray.length) {
      equiposArray.removeAt(0);
    }
    if (equipos?.length) {
      equipos.forEach(item => equiposArray.push(this.crearEquipoFormGroup(item)));
    } else {
      const grupo = this.crearEquipoFormGroup();
      this.ensureTipoEquipoDefault(grupo);
      equiposArray.push(grupo);
    }
    this.equiposArray.controls.forEach(ctrl => this.syncEquipoNombre(ctrl as FormGroup));
    equiposArray.markAsPristine();
    equiposArray.markAsUntouched();
  }

  private cargarPaquetes(eventoId: number): void {
    this.loadingPaquetes = true;
    this.dataService.getEventoServiciosFiltrado(eventoId)
      .pipe(finalize(() => {
        this.loadingPaquetes = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (detalle) => {
          this.paquetes = detalle ?? [];
          this.totalPaquetes = this.paquetes.length;
          this.totalStaff = this.paquetes.reduce(
            (acc, item) => acc + (item.staff?.detalle?.reduce((sum, st) => sum + st.cantidad, 0) ?? 0),
            0
          );
          this.selectedPaquete = null;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando paquetes', err);
          this.paquetes = [];
          this.totalPaquetes = 0;
          this.totalStaff = 0;
          this.selectedPaquete = null;
          this.cdr.markForCheck();
        }
      });
  }

  private cargarServicios(): void {
    this.dataService.getServicios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.servicios = lista ?? [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando servicios', err);
          this.servicios = [];
          this.cdr.markForCheck();
        }
      });
  }

  private cargarCategorias(): void {
    this.dataService.getCategoriasEventoServicio()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categorias) => {
          this.categorias = categorias ?? [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando categorías de paquete', err);
          this.categorias = [];
          this.cdr.markForCheck();
        }
      });
  }

  private cargarEstados(): void {
    this.dataService.getEstadosEventoServicio()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (estados) => {
          this.estados = estados ?? [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando estados de evento-servicio', err);
          this.estados = [];
          this.cdr.markForCheck();
        }
      });
  }

  private cargarCargos(): void {
    this.personalService.getCargos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cargos) => {
          this.cargos = (cargos ?? []).filter(cargo => cargo.esOperativoCampo === 1);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando cargos', err);
          this.cargos = [];
          this.cdr.markForCheck();
        }
      });
  }

  private cargarTiposEquipo(): void {
    this.dataService.getTiposEquipo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tipos) => {
          this.tipoEquipos = tipos ?? [];
          this.equiposArray.controls.forEach(ctrl => this.syncEquipoNombre(ctrl as FormGroup));
          this.equiposArray.controls.forEach(ctrl => this.ensureTipoEquipoDefault(ctrl as FormGroup));
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando tipos de equipo', err);
          this.tipoEquipos = [];
          this.cdr.markForCheck();
        }
      });
  }

  private ensureTipoEquipoDefault(control: FormGroup): void {
    const controlId = control.get('tipoEquipoId');
    if (controlId && !controlId.value && this.tipoEquipos.length) {
      controlId.setValue(this.tipoEquipos[0].idTipoEquipo);
      this.syncEquipoNombre(control);
    }
  }

  private syncEquipoNombre(control: FormGroup): void {
    const tipoId = Number(control.get('tipoEquipoId')?.value);
    if (!tipoId) return;
    const tipo = this.tipoEquipos.find(item => item.idTipoEquipo === tipoId);
    if (tipo) {
      control.get('tipoEquipo')?.setValue(tipo.nombre);
    }
  }

  mostrarCargoFueraCatalogo(valor: string | null | undefined): boolean {
    if (!valor) {
      return false;
    }
    return !this.cargos.some(item => item.cargoNombre === valor);
  }
}
