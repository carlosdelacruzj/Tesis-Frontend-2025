import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdministrarEquipos2Service } from '../service/administrar-equipos-2.service';
import { EquipoInventario } from '../models/equipo-inventario.model';
import { TableColumn } from 'src/app/components/table-base/table-base.component';

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
  private subscription: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly administrarEquipos2Service: AdministrarEquipos2Service
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
  }

  volver(): void {
    this.router.navigate(['/home/administrar-equipos-2']);
  }

  private cargarEquipos(): void {
    this.cargando = true;
    this.error = false;
    this.equipos = [];

    this.administrarEquipos2Service
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
}
