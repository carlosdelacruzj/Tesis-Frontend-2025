import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AdministrarEquiposService } from './service/administrar-equipos.service';
import { EquipoResumen } from './models/equipo-resumen.model';
import { Marca } from './models/marca.model';
import { TipoEquipo } from './models/tipo-equipo.model';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

interface ResumenPorTipo {
  idTipoEquipo: number;
  nombreTipoEquipo: string;
  totalCantidad: number;
  modelos: EquipoResumen[];
  categoria: string;
}

@Component({
  selector: 'app-administrar-equipos',
  templateUrl: './administrar-equipos.component.html',
  styleUrls: ['./administrar-equipos.component.css']
})
export class AdministrarEquiposComponent implements OnInit {
  private readonly administrarEquiposService = inject(AdministrarEquiposService);
  private readonly router = inject(Router);
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
  formMarca = {
    nombre: '',
    cargando: false,
    error: null as string | null,
    exito: null as string | null
  };
  modalMarcaOpen = false;
  formModelo = {
    nombre: '',
    idTipoEquipo: null as number | null,
    idMarca: null as number | null,
    cargando: false,
    error: null as string | null,
    exito: null as string | null
  };
  modalModeloOpen = false;
  tiposDisponibles: TipoEquipo[] = [];
  marcasDisponibles: Marca[] = [];

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
    this.router.navigate(['/home/administrar-equipos/detalle'], {
      queryParams: {
        tipo: tipo.idTipoEquipo,
        tipoNombre: tipo.nombreTipoEquipo
      },
      state: { modelos: tipo.modelos }
    });
  }

  verDetallePorModelo(tipo: ResumenPorTipo, modelo: EquipoResumen): void {
    this.router.navigate(['/home/administrar-equipos/equipos'], {
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
  }

  abrirModalMarca(): void {
    this.resetFormularioMarca();
    this.modalMarcaOpen = true;
  }

  onModalMarcaClosed(): void {
    this.modalMarcaOpen = false;
    this.resetFormularioMarca();
  }

  abrirModalModelo(): void {
    this.resetFormularioModelo();
    this.modalModeloOpen = true;
    this.cargarCatalogosModelo();
  }

  onModalModeloClosed(): void {
    this.modalModeloOpen = false;
    this.resetFormularioModelo();
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

    this.administrarEquiposService.crearTipoEquipo(nombre).subscribe({
      next: () => {
        this.formTipo.cargando = false;
        this.cargarResumen();
        this.onModalTipoClosed();
        void Swal.fire({
          icon: 'success',
          title: 'Tipo registrado',
          text: 'El tipo de equipo se creó correctamente.',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-success' }
        });
      },
      error: (error) => {
        console.error('Error al crear tipo de equipo', error);
        this.formTipo.cargando = false;
        this.formTipo.error = null;
        void Swal.fire({
          icon: 'error',
          title: 'No se pudo registrar',
          text: 'Ocurrió un problema al crear el tipo. Intenta nuevamente.',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  confirmarCrearMarca(): void {
    const nombre = this.formMarca.nombre.trim();
    this.formMarca.error = null;
    this.formMarca.exito = null;

    if (!nombre) {
      this.formMarca.error = 'Ingresa un nombre válido.';
      return;
    }

    if (this.existeMarca(nombre)) {
      this.formMarca.error = 'Ya existe una marca con ese nombre.';
      return;
    }

    this.formMarca.cargando = true;

    this.administrarEquiposService.crearMarca(nombre).subscribe({
      next: () => {
        this.formMarca.cargando = false;
        this.cargarMarcas();
        this.onModalMarcaClosed();
        void Swal.fire({
          icon: 'success',
          title: 'Marca registrada',
          text: 'La marca se creó correctamente.',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-success' }
        });
      },
      error: (error) => {
        console.error('Error al crear marca', error);
        this.formMarca.cargando = false;
        this.formMarca.error = null;
        void Swal.fire({
          icon: 'error',
          title: 'No se pudo registrar',
          text: 'Ocurrió un problema al crear la marca. Intenta nuevamente.',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  confirmarCrearModelo(): void {
    const nombre = (this.formModelo.nombre || '').trim();
    const idTipoEquipo = this.formModelo.idTipoEquipo;
    const idMarca = this.formModelo.idMarca;
    this.formModelo.error = null;
    this.formModelo.exito = null;

    if (!nombre || !idTipoEquipo || !idMarca) {
      this.formModelo.error = 'Completa todos los campos.';
      return;
    }

    this.formModelo.cargando = true;

    this.administrarEquiposService.crearModelo({ nombre, idTipoEquipo, idMarca }).subscribe({
      next: () => {
        this.formModelo.cargando = false;
        this.cargarResumen();
        this.onModalModeloClosed();
        void Swal.fire({
          icon: 'success',
          title: 'Modelo registrado',
          text: 'El modelo se creó correctamente.',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-success' }
        });
      },
      error: (error) => {
        console.error('Error al crear modelo', error);
        this.formModelo.cargando = false;
        this.formModelo.error = null;
        void Swal.fire({
          icon: 'error',
          title: 'No se pudo registrar',
          text: 'Ocurrió un problema al crear el modelo. Intenta nuevamente.',
          confirmButtonText: 'Aceptar',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-danger' }
        });
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
    forkJoin({
      resumen: this.administrarEquiposService.getResumenEquipos(),
      tipos: this.administrarEquiposService.obtenerTipos()
    }).subscribe({
      next: ({ resumen, tipos }) => {
        this.tiposDisponibles = tipos;
        if (this.modalModeloOpen && !this.formModelo.idTipoEquipo && this.tiposDisponibles.length) {
          this.formModelo.idTipoEquipo = this.tiposDisponibles[0].idTipoEquipo;
        }
        this.resumenPorTipo = this.construirResumenPorTipo(resumen, tipos);
        this.categoriasDisponibles = Array.from(
          new Set(this.resumenPorTipo.map((item) => item.categoria))
        );
        this.aplicarFiltros();
        this.cargarMarcas();
      },
      error: (error) => {
        console.error('Error al cargar el resumen de equipos', error);
      }
    });
  }

  private construirResumenPorTipo(equipos: EquipoResumen[], tipos: TipoEquipo[]): ResumenPorTipo[] {
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

    tipos.forEach((tipo) => {
      if (!mapa.has(tipo.idTipoEquipo)) {
        mapa.set(tipo.idTipoEquipo, {
          idTipoEquipo: tipo.idTipoEquipo,
          nombreTipoEquipo: tipo.nombre,
          totalCantidad: 0,
          modelos: [],
          categoria: this.obtenerCategoria(tipo.nombre)
        });
      }
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.nombreTipoEquipo.localeCompare(b.nombreTipoEquipo)
    );
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
    return this.tiposDisponibles.some(
      (tipo) => this.normalizarTexto(tipo.nombre) === normalizado
    );
  }

  private existeMarca(nombre: string): boolean {
    const normalizado = this.normalizarTexto(nombre);
    return this.marcasDisponibles.some(
      (marca) => this.normalizarTexto(marca.nombre) === normalizado
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

  private resetFormularioMarca(): void {
    this.formMarca = {
      nombre: '',
      cargando: false,
      error: null,
      exito: null
    };
  }

  private resetFormularioModelo(): void {
    this.formModelo = {
      nombre: '',
      idTipoEquipo: null,
      idMarca: null,
      cargando: false,
      error: null,
      exito: null
    };
  }

  private cargarTipos(): void {
        this.administrarEquiposService.obtenerTipos().subscribe({
      next: (tipos) => {
        this.tiposDisponibles = tipos;
        if (this.modalModeloOpen && !this.formModelo.idTipoEquipo && this.tiposDisponibles.length) {
          this.formModelo.idTipoEquipo = this.tiposDisponibles[0].idTipoEquipo;
        }
      },
      error: (error) => {
        console.error('Error al cargar tipos', error);
      }
    });
  }

  private cargarMarcas(): void {
    this.administrarEquiposService.obtenerMarcas().subscribe({
      next: (marcas) => {
        this.marcasDisponibles = marcas;
        if (this.modalModeloOpen && !this.formModelo.idMarca && this.marcasDisponibles.length) {
          this.formModelo.idMarca = this.marcasDisponibles[0].idMarca;
        }
      },
      error: (error) => {
        console.error('Error al cargar marcas', error);
      }
    });
  }

  private cargarCatalogosModelo(): void {
    if (!this.tiposDisponibles.length) {
      this.cargarTipos();
    }
    if (!this.marcasDisponibles.length) {
      this.cargarMarcas();
    }
  }
}
