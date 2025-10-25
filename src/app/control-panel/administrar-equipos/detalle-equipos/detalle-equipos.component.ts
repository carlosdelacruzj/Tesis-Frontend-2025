import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdministrarEquiposService } from '../service/administrar-equipos.service';
import { EquipoInventario } from '../models/equipo-inventario.model';
import { Modelo } from '../models/modelo.model';
import { TableColumn } from 'src/app/components/table-base/table-base.component';

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
  selector: 'app-detalle-equipos',
  templateUrl: './detalle-equipos.component.html',
  styleUrls: ['./detalle-equipos.component.css']
})
export class DetalleEquiposComponent implements OnInit, OnDestroy {
  filtros: FiltrosDetalle = {};
  equipos: EquipoInventario[] = [];
  cargando = false;
  error = false;
  readonly columnas: TableColumn<EquipoInventario>[] = [
    { key: 'serie', header: 'N° serie', sortable: true, class: 'text-uppercase' },
    { key: 'nombreMarca', header: 'Marca', sortable: true, class: 'text-capitalize' },
    { key: 'nombreModelo', header: 'Modelo', sortable: true, class: 'text-capitalize' },
    { key: 'nombreEstado', header: 'Estado', sortable: true, class: 'text-center', width: '160px' },
    { key: 'fechaIngreso', header: 'Fecha ingreso', sortable: true, class: 'text-center', width: '160px' }
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
  private cerrarEquipoTimeout: any;
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
      this.cargarEquipos();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.cerrarEquipoTimeout) {
      clearTimeout(this.cerrarEquipoTimeout);
      this.cerrarEquipoTimeout = null;
    }
  }

  volver(): void {
    this.router.navigate(['/home/administrar-equipos']);
  }

  abrirModalEquipo(): void {
    this.resetFormularioEquipo();
    this.modalEquipoOpen = true;
    this.formEquipo.fechaIngreso = new Date().toISOString().split('T')[0];
    this.establecerModeloPredeterminado();
    this.establecerEstadoPredeterminado();
    this.cargarCatalogosEquipo();
  }

  onModalEquipoClosed(): void {
    this.modalEquipoOpen = false;
    this.resetFormularioEquipo();
    if (this.cerrarEquipoTimeout) {
      clearTimeout(this.cerrarEquipoTimeout);
      this.cerrarEquipoTimeout = null;
    }
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
          this.formEquipo.exito = 'Equipo registrado correctamente.';
          this.formEquipo.cargando = false;
          this.cargarEquipos();
          this.cerrarEquipoTimeout = setTimeout(() => {
            this.onModalEquipoClosed();
          }, 1000);
        },
        error: (error) => {
          console.error('Error al registrar equipo', error);
          this.formEquipo.error = 'No se pudo registrar el equipo. Intenta nuevamente.';
          this.formEquipo.cargando = false;
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
          this.actualizarEstadosDisponibles(equipos);
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
    return resultado;
  }

  private actualizarEstadosDisponibles(equipos: EquipoInventario[]): void {
    const mapa = new Map<number, string>();
    equipos.forEach((equipo) => {
      if (!mapa.has(equipo.idEstado)) {
        mapa.set(equipo.idEstado, equipo.nombreEstado);
      }
    });
    const nuevosEstados = Array.from(mapa.entries()).map(([idEstado, nombreEstado]) => ({ idEstado, nombreEstado }));
    if (nuevosEstados.length || !this.estadosDisponibles.length) {
      this.estadosDisponibles = nuevosEstados;
    }
    this.establecerEstadoPredeterminado();
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
}
