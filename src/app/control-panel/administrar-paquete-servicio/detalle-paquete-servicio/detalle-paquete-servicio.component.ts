import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { finalize, switchMap, takeUntil } from 'rxjs/operators';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { Evento, EventoServicioCategoria, EventoServicioDetalle, EventoServicioEquipo, EstadoEventoServicio, EventoServicioStaff, Servicio } from '../model/evento-servicio.model';
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dataService = inject(EventoServicioDataService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  private readonly personalService = inject(PersonalService);
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
    { key: 'precio', header: 'Precio', sortable: true, class: 'text-center', width: '130px' },
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

  constructor() {
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
    this.setStaffEquiposValidators(true);
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
    this.setStaffEquiposValidators(false);
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
    this.paqueteEditando = null;
    this.setStaffEquiposValidators(true);
    this.form.reset();
    this.resetStaffForm();
    this.resetEquiposForm();
    this.form.markAsPristine();
    this.form.markAsUntouched();
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
    if (this.modalModo === 'crear') {
      this.normalizeCantidades();
    }
    if (this.form.invalid || !this.evento?.id) {

      this.form.markAllAsTouched();
      this.staffArray.markAllAsTouched();
      this.equiposArray.markAllAsTouched();
      return;
    }
    if (this.hasDuplicateSelections()) {
      this.markDuplicateSelectionsTouched();
      return;
    }

    const staffPayload: EventoServicioStaff[] = this.staffArray.controls.map(control => {
      const value = control.value;
      return {
        rol: String(value.cargo ?? '').trim(),
        cantidad: Number(value.cantidad)
      };
    });

    const equiposPayload = this.equiposArray.controls.map(control => {
      const value = control.value;
      return {
        tipoEquipoId: Number(value.tipoEquipoId),
        cantidad: Number(value.cantidad),
        notas: value.notas?.trim() || null
      };
    });

    const payloadBase = {
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
      filmMin: this.form.value.filmMin ?? null
    };
    const payloadCrear = {
      ...payloadBase,
      staff: staffPayload,
      equipos: equiposPayload
    };
    const payloadEditar = {
      ...payloadBase,
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
    const request$: Observable<unknown> = this.modalModo === 'crear'
      ? this.dataService.crearEventoServicio(payloadCrear)
      : (soloEstadoCambiado
          ? this.dataService.actualizarEstadoEventoServicio(this.paqueteEditando!.id, estadoSeleccionado!)
          : this.dataService.actualizarEventoServicio(this.paqueteEditando!.id, payloadEditar).pipe(
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


  onStaffCantidadBlur(index: number): void {
    const cantidadControl = this.staffArray.at(index)?.get('cantidad');
    if (!cantidadControl) return;
    cantidadControl.markAsTouched();
    cantidadControl.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  eliminarStaff(index: number): void {
    if (this.staffArray.length <= 1) return;
    this.staffArray.removeAt(index);
    this.cdr.markForCheck();
  }

  agregarEquipo(): void {
    this.equiposArray.push(this.crearEquipoFormGroup());
    this.cdr.markForCheck();
  }

  onEquipoCantidadBlur(index: number): void {
    const cantidadControl = this.equiposArray.at(index)?.get('cantidad');
    if (!cantidadControl) return;
    cantidadControl.markAsTouched();
    cantidadControl.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  eliminarEquipo(index: number): void {
    if (this.equiposArray.length <= 1) return;
    this.equiposArray.removeAt(index);
    this.cdr.markForCheck();
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

  private normalizeServicioNombre(nombre: string | null | undefined): string {
    if (!nombre) return '';
    return nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private getServicioNombrePorId(id: number | null | undefined): string | null {
    if (id == null) return null;
    const match = this.servicios.find(servicio => servicio.id === id);
    return match?.nombre ?? null;
  }

  private isServicioVideo(nombre: string | null | undefined): boolean {
    return this.normalizeServicioNombre(nombre).includes('video');
  }

  private isServicioFotografia(nombre: string | null | undefined): boolean {
    const normalized = this.normalizeServicioNombre(nombre);
    return normalized.includes('fotografia');
  }

  showFotosImpresasForm(): boolean {
    const nombre = this.getServicioNombrePorId(this.form.value.servicio ?? null);
    return !this.isServicioVideo(nombre);
  }

  showTrailerFilmForm(): boolean {
    const nombre = this.getServicioNombrePorId(this.form.value.servicio ?? null);
    return !this.isServicioFotografia(nombre);
  }

  showFotosImpresasDetalle(): boolean {
    const nombre = this.selectedPaquete?.servicio?.nombre ?? null;
    return !this.isServicioVideo(nombre);
  }

  showTrailerFilmDetalle(): boolean {
    const nombre = this.selectedPaquete?.servicio?.nombre ?? null;
    return !this.isServicioFotografia(nombre);
  }

  private crearStaffFormGroup(miembro?: EventoServicioStaff): FormGroup {
    const group = this.fb.group({
      cargo: [miembro?.rol ?? null, Validators.required],
      cantidad: [miembro?.cantidad ?? '', [Validators.required, Validators.min(1)]]
    });
    return group;
  }


  private crearEquipoFormGroup(equipo?: EventoServicioEquipo): FormGroup {
    const group = this.fb.group({
      tipoEquipoId: [equipo?.tipoEquipoId ?? null, [Validators.required, Validators.min(1)]],
      tipoEquipo: [equipo?.tipoEquipo ?? ''],
      cantidad: [equipo?.cantidad ?? '', [Validators.required, Validators.min(1)]],
      notas: [equipo?.notas ?? '']
    });
    return group;
  }

  private resetStaffForm(miembros?: EventoServicioStaff[]): void {
    const controls = miembros?.length
      ? miembros.map(miembro => this.crearStaffFormGroup(miembro))
      : [this.crearStaffFormGroup()];
    const staffArray = this.fb.array(controls, Validators.minLength(1));
    this.form.setControl('staff', staffArray as unknown as FormArray);
    staffArray.markAsPristine();
    staffArray.markAsUntouched();
  }

  private resetEquiposForm(equipos?: EventoServicioEquipo[]): void {
    const controls = equipos?.length
      ? equipos.map(item => this.crearEquipoFormGroup(item))
      : [this.crearEquipoFormGroup()];
    const equiposArray = this.fb.array(controls, Validators.minLength(1));
    this.form.setControl('equipos', equiposArray as unknown as FormArray);
    equiposArray.markAsPristine();
    equiposArray.markAsUntouched();
  }

  private toggleCantidadValidators(control: AbstractControl | null | undefined, active: boolean): void {
    if (!control) return;
    if (active) {
      control.setValidators([Validators.required, Validators.min(1)]);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity();
  }

  private setStaffEquiposValidators(required: boolean): void {
    const staff = this.form.get('staff');
    const equipos = this.form.get('equipos');
    if (required) {
      staff?.setValidators(Validators.minLength(1));
      equipos?.setValidators(Validators.minLength(1));
    } else {
      staff?.clearValidators();
      equipos?.clearValidators();
    }
    staff?.updateValueAndValidity();
    equipos?.updateValueAndValidity();
  }

  private normalizeCantidades(): void {
    this.staffArray.controls.forEach(control => {
      const cantidadControl = (control as FormGroup).get('cantidad');
      if (!cantidadControl) return;
      cantidadControl.markAsTouched();
      cantidadControl.updateValueAndValidity();
    });
    this.equiposArray.controls.forEach(control => {
      const cantidadControl = (control as FormGroup).get('cantidad');
      if (!cantidadControl) return;
      cantidadControl.markAsTouched();
      cantidadControl.updateValueAndValidity();
    });
  }

  getInvalidFieldLabels(): string[] {
    return this.collectInvalidControls(true);
  }

  private collectInvalidControls(verbose: boolean): string[] {
    const labels: Record<string, string> = {
      titulo: 'Título',
      servicio: 'Servicio',
      categoriaId: 'Categoría',
      precio: 'Precio',
      horas: 'Horas estimadas',
      staff: 'Staff',
      equipos: 'Equipos',
      cargo: 'Cargo',
      cantidad: 'Cantidad',
      tipoEquipoId: 'Tipo de equipo',
      notas: 'Notas',
      duplicado: 'Duplicado'
    };
    const invalid: string[] = [];
    const visit = (control: AbstractControl, path: string[]): void => {
      if (control instanceof FormGroup) {
        Object.entries(control.controls).forEach(([key, child]) => visit(child, [...path, key]));
        return;
      }
      if (control instanceof FormArray) {
        control.controls.forEach((child, index) => visit(child, [...path, String(index)]));
        if (control.invalid && !control.controls.length) {
          invalid.push(labels[path[path.length - 1]] ?? path.join('.'));
        }
        return;
      }
      if (control.invalid) {
        const label = labels[path[path.length - 1]] ?? path.join('.');
        if (verbose) {
          const pathLabel = path.length ? `${path.join('.')}` : label;
          const value = control.value;
          const valueText = value === null || value === undefined ? 'vacío' : String(value).trim() || 'vacío';
          invalid.push(`${label} (${pathLabel}, valor: ${valueText})`);
        } else {
          invalid.push(label);
        }
      }
    };
    visit(this.form, []);
    return Array.from(new Set(invalid));
  }

  private hasDuplicateSelections(): boolean {
    const staffValues = this.staffArray.controls
      .map(ctrl => String((ctrl as FormGroup).get('cargo')?.value ?? '').trim())
      .filter(value => value.length > 0);
    const equiposValues = this.equiposArray.controls
      .map(ctrl => String((ctrl as FormGroup).get('tipoEquipoId')?.value ?? '').trim())
      .filter(value => value.length > 0);
    return this.hasDuplicates(staffValues) || this.hasDuplicates(equiposValues);
  }

  private hasDuplicates(values: string[]): boolean {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) return true;
      seen.add(value);
    }
    return false;
  }

  private markDuplicateSelectionsTouched(): void {
    this.staffArray.controls.forEach(control => {
      (control as FormGroup).get('cargo')?.markAsTouched();
    });
    this.equiposArray.controls.forEach(control => {
      (control as FormGroup).get('tipoEquipoId')?.markAsTouched();
    });
  }

  availableCargos(currentValue: string | null | undefined): Cargo[] {
    const selected = new Set(
      this.staffArray.controls
        .map(ctrl => String((ctrl as FormGroup).get('cargo')?.value ?? '').trim())
        .filter(value => value.length > 0)
    );
    const current = String(currentValue ?? '').trim();
    if (current) selected.delete(current);
    return this.cargos
      .filter(cargo => cargo.esOperativoCampo === 1)
      .filter(cargo => !selected.has(cargo.cargoNombre));
  }

  availableTiposEquipo(currentValue: number | null | undefined): TipoEquipo[] {
    const selected = new Set(
      this.equiposArray.controls
        .map(ctrl => Number((ctrl as FormGroup).get('tipoEquipoId')?.value))
        .filter(value => Number.isFinite(value) && value > 0)
    );
    if (currentValue != null) selected.delete(Number(currentValue));
    return this.tipoEquipos.filter(tipo => !selected.has(tipo.idTipoEquipo));
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
          this.cargos = cargos ?? [];
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
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando tipos de equipo', err);
          this.tipoEquipos = [];
          this.cdr.markForCheck();
        }
      });
  }

}
