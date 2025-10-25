import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdministrarEquiposService } from '../service/administrar-equipos.service';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { EquipoResumen } from '../models/equipo-resumen.model';

interface FiltrosDetalle {
  tipo?: string;
  tipoNombre?: string;
}

interface ResumenModelo {
  idMarca: number;
  nombreMarca: string;
  idModelo: number;
  nombreModelo: string;
  total: number;
  disponibles: number;
}

@Component({
  selector: 'app-detalle-equipos',
  templateUrl: './detalle-equipos.component.html',
  styleUrls: ['./detalle-equipos.component.css']
})
export class DetalleEquiposComponent implements OnInit, OnDestroy {
  filtros: FiltrosDetalle = {};
  resumenModelos: ResumenModelo[] = [];
  busqueda = '';
  cargando = false;
  error = false;
  private modelosDesdeEstado: EquipoResumen[] | undefined;
  readonly columnasResumen: TableColumn<ResumenModelo>[] = [
    { key: 'nombreMarca', header: 'Marca', sortable: true, class: 'text-capitalize' },
    { key: 'nombreModelo', header: 'Modelo', sortable: true, class: 'text-capitalize' },
    { key: 'total', header: 'Total', sortable: true, class: 'text-center', width: '140px' },
    { key: 'disponibles', header: 'Disponibles', sortable: true, class: 'text-center', width: '140px' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, class: 'text-center', width: '160px' }
  ];
  private subscription: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly administrarEquiposService: AdministrarEquiposService
  ) {}

  ngOnInit(): void {
    if (Object.prototype.hasOwnProperty.call(history.state, 'modelos')) {
      const modelos = history.state.modelos;
      this.modelosDesdeEstado = Array.isArray(modelos) ? modelos : [];
    } else {
      this.modelosDesdeEstado = undefined;
    }

    this.subscription = this.route.queryParamMap.subscribe((params) => {
      this.filtros = {
        tipo: params.get('tipo') ?? undefined,
        tipoNombre: params.get('tipoNombre') ?? undefined
      };
      this.cargarResumen();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get toolbarTitle(): string {
    return this.filtros.tipoNombre ?? 'Inventario de equipos';
  }

  get toolbarDescription(): string {
    return 'Consulta los modelos disponibles y accede al detalle completo.';
  }

  get totalModelos(): number {
    return this.resumenModelos.length;
  }

  get totalEquipos(): number {
    return this.resumenModelos.reduce((acc, grupo) => acc + grupo.total, 0);
  }

  get totalDisponibles(): number {
    return this.resumenModelos.reduce((acc, grupo) => acc + grupo.disponibles, 0);
  }

  get gruposFiltrados(): ResumenModelo[] {
    const termino = this.busqueda.trim().toLowerCase();
    if (!termino) {
      return this.resumenModelos;
    }
    return this.resumenModelos.filter((grupo) =>
      [
        grupo.nombreMarca,
        grupo.nombreModelo,
        grupo.total.toString(),
        grupo.disponibles.toString()
      ]
        .some((valor) => valor.toLowerCase().includes(termino))
    );
  }

  onBuscar(valor: string): void {
    this.busqueda = valor ?? '';
  }

  verDetalleModelo(grupo: ResumenModelo): void {
    this.router.navigate(['/home/administrar-equipos/equipos'], {
      queryParams: {
        tipo: this.filtros.tipo,
        tipoNombre: this.filtros.tipoNombre,
        marca: grupo.idMarca,
        marcaNombre: grupo.nombreMarca,
        modelo: grupo.idModelo,
        modeloNombre: grupo.nombreModelo
      }
    });
  }

  verDetalleGeneral(): void {
    this.router.navigate(['/home/administrar-equipos/equipos'], {
      queryParams: {
        tipo: this.filtros.tipo,
        tipoNombre: this.filtros.tipoNombre
      }
    });
  }

  volver(): void {
    this.router.navigate(['/home/administrar-equipos']);
  }

  private cargarResumen(): void {
    this.cargando = true;
    this.error = false;
    this.resumenModelos = [];

    if (this.modelosDesdeEstado !== undefined) {
      this.resumenModelos = this.convertirDesdeResumen(this.modelosDesdeEstado);
      this.cargando = false;
      return;
    }

    this.administrarEquiposService.getResumenEquipos().subscribe({
      next: (resumen) => {
        const filtrados = resumen.filter((item) =>
          this.filtros.tipo ? item.idTipoEquipo === Number(this.filtros.tipo) : true
        );
        this.resumenModelos = this.convertirDesdeResumen(filtrados);
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al obtener el resumen de equipos', error);
        this.cargando = false;
        this.error = true;
      }
    });
  }

  private convertirDesdeResumen(modelos: EquipoResumen[]): ResumenModelo[] {
    const mapa = new Map<number, ResumenModelo>();

    modelos.forEach((modelo) => {
      const existente = mapa.get(modelo.idModelo);
      const total = modelo.cantidad ?? 0;
      const disponibles = total; // El resumen no distingue estados; asumimos todo disponible para mostrar el botón.

      if (existente) {
        existente.total += total;
        existente.disponibles += disponibles;
        return;
      }

      mapa.set(modelo.idModelo, {
        idMarca: modelo.idMarca,
        nombreMarca: modelo.nombreMarca,
        idModelo: modelo.idModelo,
        nombreModelo: modelo.nombreModelo,
        total,
        disponibles
      });
    });

    return Array.from(mapa.values()).sort((a, b) => {
      const marcaCompare = a.nombreMarca.localeCompare(b.nombreMarca);
      if (marcaCompare !== 0) {
        return marcaCompare;
      }
      return a.nombreModelo.localeCompare(b.nombreModelo);
    });
  }
}
