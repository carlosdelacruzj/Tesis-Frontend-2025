import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdministrarEquipos2Service, ResumenEquipo } from './administrar-equipos-2.service';

interface ResumenPorTipo {
  idTipoEquipo: number;
  nombreTipoEquipo: string;
  totalCantidad: number;
  modelos: ResumenEquipo[];
  categoria: string;
}

@Component({
  selector: 'app-administrar-equipos-2',
  templateUrl: './administrar-equipos-2.component.html',
  styleUrls: ['./administrar-equipos-2.component.css']
})
export class AdministrarEquipos2Component implements OnInit {
  resumenPorTipo: ResumenPorTipo[] = [];
  filtradoResumen: ResumenPorTipo[] = [];
  readonly maxModelosCompactos = 5;
  categoriasDisponibles: string[] = [];
  filtroTexto = '';
  categoriaSeleccionada = 'todas';

  constructor(
    private readonly administrarEquipos2Service: AdministrarEquipos2Service,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.cargarResumen();
  }

  trackByTipo(_: number, item: ResumenPorTipo): number {
    return item.idTipoEquipo;
  }

  trackByModelo(_: number, item: ResumenEquipo): number {
    return item.idModelo;
  }

  verDetallePorTipo(tipo: ResumenPorTipo): void {
    this.router.navigate(['/home/administrar-equipos-2/detalle'], {
      queryParams: {
        tipo: tipo.idTipoEquipo,
        tipoNombre: tipo.nombreTipoEquipo
      }
    });
  }

  verDetallePorModelo(tipo: ResumenPorTipo, modelo: ResumenEquipo): void {
    this.router.navigate(['/home/administrar-equipos-2/detalle'], {
      queryParams: {
        tipo: tipo.idTipoEquipo,
        tipoNombre: tipo.nombreTipoEquipo,
        marca: modelo.idMarca,
        marcaNombre: modelo.nombreMarca,
        modelo: modelo.idModelo,
        modeloNombre: modelo.nombreModelo
      }
    });
  }

  onBuscar(term: string): void {
    this.filtroTexto = term.trim().toLowerCase();
    this.aplicarFiltros();
  }

  onSeleccionarCategoria(valor: string): void {
    this.categoriaSeleccionada = valor;
    this.aplicarFiltros();
  }

  private aplicarFiltros(): void {
    const coincideCategoria = (item: ResumenPorTipo) =>
      this.categoriaSeleccionada === 'todas' || item.categoria === this.categoriaSeleccionada;

    const coincideTexto = (item: ResumenPorTipo) => {
      if (!this.filtroTexto) {
        return true;
      }
      const texto = this.filtroTexto;
      return (
        item.nombreTipoEquipo.toLowerCase().includes(texto) ||
        item.modelos.some((modelo) =>
          `${modelo.nombreMarca} ${modelo.nombreModelo}`.toLowerCase().includes(texto)
        )
      );
    };

    this.filtradoResumen = this.resumenPorTipo.filter(
      (item) => coincideCategoria(item) && coincideTexto(item)
    );
  }

  private cargarResumen(): void {
    this.administrarEquipos2Service.getResumenEquipos().subscribe({
      next: (equipos) => {
        this.resumenPorTipo = this.agruparPorTipo(equipos);
        this.categoriasDisponibles = Array.from(
          new Set(this.resumenPorTipo.map((item) => item.categoria))
        );
        this.aplicarFiltros();
      },
      error: (error) => {
        console.error('Error al cargar el resumen de equipos', error);
      }
    });
  }

  private agruparPorTipo(equipos: ResumenEquipo[]): ResumenPorTipo[] {
    const mapa = new Map<number, ResumenPorTipo>();

    equipos.forEach((equipo) => {
      const existente = mapa.get(equipo.idTipoEquipo);

      if (!existente) {
        mapa.set(equipo.idTipoEquipo, {
          idTipoEquipo: equipo.idTipoEquipo,
          nombreTipoEquipo: equipo.nombreTipoEquipo,
          totalCantidad: equipo.cantidad,
          modelos: [equipo],
          categoria: this.obtenerCategoria(equipo.nombreTipoEquipo)
        });
        return;
      }

      existente.totalCantidad += equipo.cantidad;
      existente.modelos = [...existente.modelos, equipo];
    });

    return Array.from(mapa.values());
  }

  private obtenerCategoria(nombreTipo: string): string {
    const texto = nombreTipo.toLowerCase();

    if (texto.includes('cámara') || texto.includes('drone') || texto.includes('video')) {
      return 'Video';
    }

    if (texto.includes('micrófono') || texto.includes('audio') || texto.includes('recorder')) {
      return 'Audio';
    }

    if (texto.includes('iluminación') || texto.includes('luz') || texto.includes('led')) {
      return 'Iluminación';
    }

    return 'Otros';
  }
}
