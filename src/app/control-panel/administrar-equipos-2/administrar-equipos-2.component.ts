import { Component } from '@angular/core';
import { TableColumn } from 'src/app/components/table-base-mejora/table-base-mejora.component';

type EstadoPropio = 'operativo' | 'mantenimiento' | 'reserva' | 'baja';
type EstadoAlquilado = 'activo' | 'por-vencer' | 'devuelto';

interface EquipoPropio {
  id: number;
  tipo: string;
  marca: string;
  modelo: string;
  estado: EstadoPropio;
  cantidad: number;
  ubicacion: string;
  responsable: string;
}

interface EquipoAlquilado {
  id: number;
  tipo: string;
  proveedor: string;
  serie: string;
  estado: EstadoAlquilado;
  proyecto: string;
  finContrato: string;
  responsable: string;
  contactoProveedor: string;
}

interface EquipoSeleccionado {
  origen: 'propio' | 'alquilado';
  registro: EquipoPropio | EquipoAlquilado;
}

@Component({
  selector: 'app-administrar-equipos-2',
  templateUrl: './administrar-equipos-2.component.html',
  styleUrls: ['./administrar-equipos-2.component.css']
})
export class AdministrarEquipos2Component {
  /** Columnas reutilizando la tabla base */
  readonly columnasPropios: TableColumn<EquipoPropio>[] = [
    { key: 'tipo', header: 'Equipo', sortable: true, class: 'text-capitalize' },
    { key: 'marca', header: 'Marca', sortable: true, class: 'text-capitalize' },
    { key: 'modelo', header: 'Modelo', sortable: true, class: 'text-capitalize' },
    { key: 'estado', header: 'Estado', sortable: true, class: 'text-center estado-col', width: '140px' },
    { key: 'cantidad', header: 'Stock', sortable: true, class: 'text-center', width: '90px' },
    { key: 'ubicacion', header: 'Ubicación', sortable: true, class: 'text-capitalize' },
    { key: 'responsable', header: 'Responsable', sortable: true, class: 'text-capitalize' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, class: 'text-center acciones-col', width: '120px' }
  ];

  readonly columnasAlquilados: TableColumn<EquipoAlquilado>[] = [
    { key: 'tipo', header: 'Equipo', sortable: true, class: 'text-capitalize' },
    { key: 'proveedor', header: 'Proveedor', sortable: true, class: 'text-capitalize' },
    { key: 'serie', header: 'Serie', sortable: true, class: 'text-uppercase' },
    { key: 'estado', header: 'Estado', sortable: true, class: 'text-center estado-col', width: '140px' },
    { key: 'proyecto', header: 'Proyecto asignado', sortable: true },
    { key: 'finContrato', header: 'Fin contrato', sortable: true, class: 'text-center', width: '130px' },
    { key: 'responsable', header: 'Responsable', sortable: true, class: 'text-capitalize' },
    { key: 'acciones', header: 'Acciones', sortable: false, filterable: false, class: 'text-center acciones-col', width: '120px' }
  ];

  /** Mock de datos para el maquetado */
  equiposPropios: EquipoPropio[] = [
    { id: 1, tipo: 'Consola de sonido', marca: 'Yamaha', modelo: 'QL5', estado: 'operativo', cantidad: 3, ubicacion: 'Almacén Lima', responsable: 'María Torres' },
    { id: 2, tipo: 'Cabeza móvil', marca: 'Clay Paky', modelo: 'Mythos 2', estado: 'mantenimiento', cantidad: 2, ubicacion: 'Taller Piura', responsable: 'Fiorella Díaz' },
    { id: 3, tipo: 'Truss 3m', marca: 'Prolyte', modelo: 'H30V', estado: 'reserva', cantidad: 12, ubicacion: 'Almacén Lima', responsable: 'Alberto Ruiz' },
    { id: 4, tipo: 'Generador eléctrico', marca: 'Honda', modelo: 'EU70is', estado: 'operativo', cantidad: 1, ubicacion: 'Proyecto Feria Innova', responsable: 'Luis Ortega' }
  ];

  equiposAlquilados: EquipoAlquilado[] = [
    { id: 101, tipo: 'Pantalla LED 3.9mm', proveedor: 'ProDisplay', serie: 'PD-39-781', estado: 'activo', proyecto: 'Cusco Fest 2024', finContrato: '2024-05-22', responsable: 'Patricia Gómez', contactoProveedor: 'ventas@prodisplay.pe' },
    { id: 102, tipo: 'Switcher de video 4K', proveedor: 'LiveRent', serie: 'LR-ATEM-204', estado: 'por-vencer', proyecto: 'Expo Tech 2024', finContrato: '2024-04-30', responsable: 'Carlos Vega', contactoProveedor: '+51 987 654 321' },
    { id: 103, tipo: 'Line Array K2', proveedor: 'SoundHire', serie: 'SH-K2-332', estado: 'devuelto', proyecto: 'Aniversario UPC', finContrato: '2024-03-15', responsable: 'Juan Pérez', contactoProveedor: 'logistica@soundhire.pe' }
  ];

  selectedEquipo: EquipoSeleccionado | null = null;

  /** Etiquetas de estado para chips */
  private readonly estadoPropioMap: Record<EstadoPropio, string> = {
    operativo: 'Operativo',
    mantenimiento: 'En mantenimiento',
    reserva: 'Reservado',
    baja: 'De baja'
  };

  private readonly estadoAlquiladoMap: Record<EstadoAlquilado, string> = {
    activo: 'Contrato activo',
    'por-vencer': 'Próximo a vencer',
    devuelto: 'Devuelto'
  };

  trackById(_: number, item: EquipoPropio | EquipoAlquilado): number {
    return item.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  registrarEquipoPropio(): void {
    console.log('Registrar nuevo equipo propio');
  }

  registrarEquipoAlquilado(): void {
    console.log('Registrar nuevo equipo alquilado');
  }

  editarEquipo(registro: EquipoPropio | EquipoAlquilado, origen: 'propio' | 'alquilado'): void {
    console.log('Editar', origen, registro);
  }

  eliminarEquipo(registro: EquipoPropio | EquipoAlquilado, origen: 'propio' | 'alquilado'): void {
    console.log('Eliminar', origen, registro);
  }

  seleccionarPropio(registro: EquipoPropio): void {
    this.selectedEquipo = { origen: 'propio', registro };
  }

  seleccionarAlquilado(registro: EquipoAlquilado): void {
    this.selectedEquipo = { origen: 'alquilado', registro };
  }

  cerrarDetalle(): void {
    this.selectedEquipo = null;
  }

  etiquetaEstadoPropio(estado: EstadoPropio): string {
    return this.estadoPropioMap[estado] ?? estado;
  }

  etiquetaEstadoAlquilado(estado: EstadoAlquilado): string {
    return this.estadoAlquiladoMap[estado] ?? estado;
  }

  propioSeleccionado(): EquipoPropio | null {
    if (this.selectedEquipo?.origen !== 'propio') {
      return null;
    }
    return this.selectedEquipo.registro as EquipoPropio;
  }

  alquiladoSeleccionado(): EquipoAlquilado | null {
    if (this.selectedEquipo?.origen !== 'alquilado') {
      return null;
    }
    return this.selectedEquipo.registro as EquipoAlquilado;
  }
}
