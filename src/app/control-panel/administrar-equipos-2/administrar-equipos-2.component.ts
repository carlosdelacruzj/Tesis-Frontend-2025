import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdministrarEquipos2Service } from './service/administrar-equipos-2.service';
import { EquipoResumen } from './models/equipo-resumen.model';

interface ResumenPorTipo {
  idTipoEquipo: number;
  nombreTipoEquipo: string;
  totalCantidad: number;
  modelos: EquipoResumen[];
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
  busqueda = '';
  filtroTexto = '';
  categoriaSeleccionada = 'todas';
  formTipo = {
    nombre: '',
    confirmacion: false,
    cargando: false,
    error: null as string | null,
    exito: null as string | null
  };
  modalTipoOpen = false;
  private cerrarTipoTimeout: any;

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

  trackByModelo(_: number, item: EquipoResumen): number {
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

  verDetallePorModelo(tipo: ResumenPorTipo, modelo: EquipoResumen): void {
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

  abrirModalTipo(): void {
    this.resetFormularioTipo();
    this.modalTipoOpen = true;
  }

  onModalTipoClosed(): void {
    this.modalTipoOpen = false;
    this.resetFormularioTipo();
    if (this.cerrarTipoTimeout) {
      clearTimeout(this.cerrarTipoTimeout);
      this.cerrarTipoTimeout = null;
    }
  }

  onBuscar(term: string): void {
    const safeTerm = term ?? '';
    this.busqueda = safeTerm;
    this.filtroTexto = this.normalizarTexto(safeTerm);
    this.aplicarFiltros();
  }

  onSeleccionarCategoria(valor: string): void {
    this.categoriaSeleccionada = valor;
    this.aplicarFiltros();
  }

  confirmarCrearTipo(): void {
    const nombre = this.formTipo.nombre.trim();
    this.formTipo.error = null;
    this.formTipo.exito = null;

    if (!nombre) {
      this.formTipo.error = 'Ingresa un nombre válido.';
      return;
    }

    if (this.existeTipo(nombre)) {
      this.formTipo.error = 'Ya existe un tipo con ese nombre.';
      return;
    }

    if (!this.formTipo.confirmacion) {
      this.formTipo.error = 'Debes confirmar que el nombre es correcto.';
      return;
    }

    this.formTipo.cargando = true;

    this.administrarEquipos2Service.crearTipoEquipo(nombre).subscribe({
      next: () => {
        this.formTipo.exito = 'Tipo creado correctamente.';
        this.formTipo.cargando = false;
        this.cargarResumen();
        this.cerrarTipoTimeout = setTimeout(() => {
          this.onModalTipoClosed();
        }, 1000);
      },
      error: (error) => {
        console.error('Error al crear tipo de equipo', error);
        this.formTipo.error = 'No se pudo crear el tipo. Intenta nuevamente.';
        this.formTipo.cargando = false;
      }
    });
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
        this.normalizarTexto(item.nombreTipoEquipo).includes(texto) ||
        item.modelos.some((modelo) =>
          this.normalizarTexto(`${modelo.nombreMarca} ${modelo.nombreModelo}`).includes(texto)
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

  private agruparPorTipo(equipos: EquipoResumen[]): ResumenPorTipo[] {
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
    const texto = this.normalizarTexto(nombreTipo);

    if (texto.includes('camara') || texto.includes('drone') || texto.includes('video')) {
      return 'Video';
    }

    if (texto.includes('microfono') || texto.includes('audio') || texto.includes('recorder')) {
      return 'Audio';
    }

    if (texto.includes('iluminacion') || texto.includes('luz') || texto.includes('led')) {
      return 'Iluminación';
    }

    return 'Otros';
  }

  normalizarEntrada(valor: string | null | undefined): string {
    if (!valor) {
      return '';
    }
    return valor.replace(/\s+/g, ' ');
  }

  private normalizarTexto(texto: string | null | undefined): string {
    return (texto ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private existeTipo(nombre: string): boolean {
    const normalizado = this.normalizarTexto(nombre);
    return this.resumenPorTipo.some(
      (tipo) => this.normalizarTexto(tipo.nombreTipoEquipo) === normalizado
    );
  }

  private resetFormularioTipo(): void {
    this.formTipo = {
      nombre: '',
      confirmacion: false,
      cargando: false,
      error: null,
      exito: null
    };
  }
}
