import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdministrarEquiposService } from '../service/administrar-equipos.service';
import { EquipoInventario } from '../models/equipo-inventario.model';
import { Modelo } from '../models/modelo.model';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

interface EstadoInventario {
  idEstado: number;
  nombreEstado: string;
}

interface FiltrosDetalle {
  tipo?: string;
  tipoNombre?: string;
  marca?: string;
  marcaNombre?: string;
  modelo?: string;
  modeloNombre?: string;
}

@Component({
  selector: 'app-equipo-detalle',
  templateUrl: './equipo-detalle.component.html',
  styleUrls: ['./equipo-detalle.component.css']
})
export class EquipoDetalleComponent implements OnInit, OnDestroy {
  private readonly estadoDisponibleNombre = 'Disponible';
  filtros: FiltrosDetalle = {};
  equipos: EquipoInventario[] = [];
  busqueda = '';
  cargando = false;
  error = false;
  readonly columnas: TableColumn<EquipoInventario>[] = [
    { key: 'serie', header: 'N° serie', sortable: true, class: 'text-uppercase' },
    { key: 'nombreMarca', header: 'Marca', sortable: true, class: 'text-capitalize' },
    { key: 'nombreModelo', header: 'Modelo', sortable: true, class: 'text-capitalize' },
    { key: 'nombreEstado', header: 'Estado', sortable: true, class: 'text-center', width: '160px' },
    { key: 'fechaIngreso', header: 'Fecha ingreso', sortable: true, class: 'text-center', width: '160px' },
    { key: 'acciones', header: 'Acciones', sortable: false, class: 'text-center', width: '180px' }
  ];
  modalEquipoOpen = false;
  modelosDisponibles: Modelo[] = [];
  estadosDisponibles: EstadoInventario[] = [];
  formEquipo = {
    fechaIngreso: '',
    idModelo: null as number | null,
    idEstado: null as number | null,
    serie: '',
    cargando: false,
    error: null as string | null,
    exito: null as string | null
  };
  estadoModal = {
    open: false,
    idEstado: null as number | null,
    cargando: false,
    error: null as string | null,
    equipo: null as EquipoInventario | null
  };
  private subscription: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly administrarEquiposService: AdministrarEquiposService
  ) {}

  ngOnInit(): void {
    this.subscription = this.route.queryParamMap.subscribe((params) => {
      this.filtros = {
        tipo: params.get('tipo') ?? undefined,
        tipoNombre: params.get('tipoNombre') ?? undefined,
        marca: params.get('marca') ?? undefined,
        marcaNombre: params.get('marcaNombre') ?? undefined,
        modelo: params.get('modelo') ?? undefined,
        modeloNombre: params.get('modeloNombre') ?? undefined
      };
      this.cargarEstados();
      this.cargarEquipos();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get toolbarTitle(): string {
    const tipo = this.filtros.tipoNombre ?? 'Inventario de equipos';
    const modelo = this.filtros.modeloNombre ? ` · ${this.filtros.modeloNombre}` : '';
    return `${tipo}${modelo}`;
  }

  get toolbarDescription(): string {
    if (this.filtros.marcaNombre || this.filtros.modeloNombre) {
      const marca = this.filtros.marcaNombre ?? 'Todas las marcas';
      const modelo = this.filtros.modeloNombre ?? 'Todos los modelos';
      return `${marca} · ${modelo}`;
    }
    return 'Consulta los equipos registrados y su estado actual.';
  }

  get equiposFiltrados(): EquipoInventario[] {
    const termino = this.busqueda.trim().toLowerCase();
    if (!termino) {
      return this.equipos;
    }
    return this.equipos.filter((equipo) =>
      [
        equipo.serie,
        equipo.nombreMarca,
        equipo.nombreModelo,
        equipo.nombreEstado
      ]
        .filter((valor): valor is string => !!valor)
        .some((valor) => valor.toLowerCase().includes(termino))
    );
  }

  onBuscar(valor: string): void {
    this.busqueda = valor ?? '';
  }

  get modeloFijo(): boolean {
    return !!this.filtros.modelo;
  }

  volver(): void {
    this.router.navigate(['/home/administrar-equipos/detalle'], {
      queryParams: {
        tipo: this.filtros.tipo,
        tipoNombre: this.filtros.tipoNombre,
        vista: null,
        modelo: null,
        modeloNombre: null,
        marca: null,
        marcaNombre: null
      }
    });
  }

  abrirModalEquipo(): void {
    this.resetFormularioEquipo();
    this.modalEquipoOpen = true;
    this.formEquipo.fechaIngreso = new Date().toISOString().split('T')[0];
    this.establecerModeloPredeterminado();
    this.cargarCatalogosEquipo();
    this.cargarEstados('registro');
  }

  onModalEquipoClosed(): void {
    this.modalEquipoOpen = false;
    this.resetFormularioEquipo();
  }

  confirmarCrearEquipo(): void {
    const fechaIngreso = this.formEquipo.fechaIngreso;
    const idModelo = this.formEquipo.idModelo;
    const idEstado = this.formEquipo.idEstado;
    const serie = (this.formEquipo.serie || '').trim();
    this.formEquipo.error = null;
    this.formEquipo.exito = null;

    if (!fechaIngreso || !idModelo || !idEstado || !serie) {
      this.formEquipo.error = 'Completa todos los campos.';
      return;
    }

    this.formEquipo.cargando = true;

    this.administrarEquiposService
      .crearEquipo({ fechaIngreso, idModelo, idEstado, serie })
      .subscribe({
        next: () => {
          this.formEquipo.cargando = false;
          this.cargarEquipos();
          this.onModalEquipoClosed();
          void Swal.fire({
            icon: 'success',
            title: 'Equipo registrado',
            text: 'El equipo se registró correctamente en el inventario.',
            confirmButtonText: 'Aceptar',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-success' }
          });
        },
        error: (error) => {
          console.error('Error al registrar equipo', error);
          this.formEquipo.cargando = false;
          this.formEquipo.error = null;
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo registrar',
            text: 'Ocurrió un problema al registrar el equipo. Intenta nuevamente.',
            confirmButtonText: 'Aceptar',
            buttonsStyling: false,
            customClass: { confirmButton: 'btn btn-danger' }
          });
        }
      });
  }

  private cargarEquipos(): void {
    this.cargando = true;
    this.error = false;
    this.equipos = [];

    this.administrarEquiposService
      .getEquipos({
        tipo: this.filtros.tipo,
        marca: this.filtros.marca,
        modelo: this.filtros.modelo
      })
      .subscribe({
        next: (equipos) => {
          this.equipos = equipos;
          this.cargando = false;
        },
        error: (error) => {
          console.error('Error al obtener el detalle de equipos', error);
          this.cargando = false;
          this.error = true;
        }
      });
  }

  private cargarCatalogosEquipo(): void {
    this.modelosDisponibles = [];
    this.administrarEquiposService.obtenerModelos().subscribe({
      next: (modelos) => {
        this.modelosDisponibles = this.filtrarModelos(modelos);
        this.establecerModeloPredeterminado();
      },
      error: (error) => {
        console.error('Error al cargar modelos', error);
      }
    });
  }

  private filtrarModelos(modelos: Modelo[]): Modelo[] {
    let resultado = modelos;
    if (this.filtros.tipo) {
      const idTipo = Number(this.filtros.tipo);
      resultado = resultado.filter((modelo) => modelo.idTipoEquipo === idTipo);
    }
    if (this.filtros.marca) {
      const idMarca = Number(this.filtros.marca);
      resultado = resultado.filter((modelo) => modelo.idMarca === idMarca);
    }
    if (this.filtros.modelo) {
      const idModelo = Number(this.filtros.modelo);
      resultado = resultado.filter((modelo) => modelo.idModelo === idModelo);
    }
    return resultado;
  }

  private cargarEstados(context: 'registro' | 'estado' | null = null): void {
    if (this.estadosDisponibles.length) {
      this.ajustarEstadosSegunContexto(context);
      return;
    }

    this.administrarEquiposService.obtenerEstados().subscribe({
      next: (estados) => {
        this.estadosDisponibles = estados
          .map((estado) => ({
            idEstado: estado.idEstado,
            nombreEstado: estado.nombreEstado
          }))
          .sort((a, b) => a.nombreEstado.localeCompare(b.nombreEstado));
        this.ajustarEstadosSegunContexto(context);
      },
      error: (error) => {
        console.error('Error al cargar estados', error);
      }
    });
  }

  private ajustarEstadosSegunContexto(context: 'registro' | 'estado' | null): void {
    if (context === 'registro') {
      this.establecerEstadoPredeterminado();
    }
    if (context === 'estado' && this.estadoModal.open) {
      this.estadoModal.idEstado = this.estadoModal.idEstado ?? this.estadoModal.equipo?.idEstado ?? null;
    }
  }

  private establecerModeloPredeterminado(): void {
    if (this.formEquipo.idModelo) {
      return;
    }
    if (this.filtros.modelo) {
      const idModelo = Number(this.filtros.modelo);
      if (this.modelosDisponibles.some((modelo) => modelo.idModelo === idModelo)) {
        this.formEquipo.idModelo = idModelo;
        return;
      }
    }
    this.formEquipo.idModelo = this.modelosDisponibles.length ? this.modelosDisponibles[0].idModelo : null;
  }

  private establecerEstadoPredeterminado(): void {
    if (this.formEquipo.idEstado) {
      return;
    }
    const disponible = this.obtenerEstadoDisponibleId();
    if (disponible) {
      this.formEquipo.idEstado = disponible;
      return;
    }
    this.formEquipo.idEstado = this.estadosDisponibles.length ? this.estadosDisponibles[0].idEstado : null;
  }

  private resetFormularioEquipo(): void {
    this.formEquipo = {
      fechaIngreso: '',
      idModelo: null,
      idEstado: null,
      serie: '',
      cargando: false,
      error: null,
      exito: null
    };
  }

  abrirModalEstado(equipo: EquipoInventario): void {
    this.estadoModal = {
      open: true,
      idEstado: equipo.idEstado,
      cargando: false,
      error: null,
      equipo
    };
    this.cargarEstados('estado');
  }

  cerrarModalEstado(): void {
    this.estadoModal = {
      open: false,
      idEstado: null,
      cargando: false,
      error: null,
      equipo: null
    };
  }

  async confirmarCambioEstado(): Promise<void> {
    if (!this.estadoModal.equipo || !this.estadoModal.idEstado) {
      this.estadoModal.error = 'Selecciona un estado válido.';
      return;
    }

    const { isConfirmed } = await Swal.fire({
      icon: 'question',
      title: 'Confirmar cambio',
      text: '¿Deseas cambiar el estado del equipo?',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar',
      buttonsStyling: false,
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-outline-secondary'
      }
    });

    if (!isConfirmed) {
      return;
    }

    this.estadoModal.cargando = true;
    this.estadoModal.error = null;

    const idEquipo = this.estadoModal.equipo.idEquipo;
    const idEstado = this.estadoModal.idEstado;

    this.administrarEquiposService.actualizarEstadoEquipo(idEquipo, idEstado).subscribe({
      next: (actualizado) => {
        this.estadoModal.cargando = false;
        const indice = this.equipos.findIndex((item) => item.idEquipo === actualizado.idEquipo);
        if (indice !== -1) {
          const copia = [...this.equipos];
          copia[indice] = { ...copia[indice], ...actualizado };
          this.equipos = copia;
        }
        this.cerrarModalEstado();
        void Swal.fire({
          icon: 'success',
          title: 'Estado actualizado',
          text: 'El estado del equipo se actualizó correctamente.',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-success' }
        });
      },
      error: (error) => {
        console.error('Error al actualizar estado de equipo', error);
        this.estadoModal.cargando = false;
        this.estadoModal.error = null;
        void Swal.fire({
          icon: 'error',
          title: 'No se pudo actualizar',
          text: 'Ocurrió un problema al cambiar el estado. Intenta nuevamente.',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  private obtenerEstadoDisponibleId(): number | null {
    const encontrado = this.estadosDisponibles.find(
      (estado) => estado.nombreEstado?.toLowerCase() === this.estadoDisponibleNombre.toLowerCase()
    );
    return encontrado ? encontrado.idEstado : null;
  }
}
