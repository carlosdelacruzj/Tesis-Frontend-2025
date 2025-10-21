import { Component } from '@angular/core';

interface AgendaResumenItem {
  titulo: string;
  valor: string;
  icono: string;
  descripcion: string;
  tema: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

interface AgendaEvento {
  titulo: string;
  cliente: string;
  fecha: string;
  hora: string;
  ubicacion: string;
  estado: 'Programado' | 'En curso' | 'Finalizado' | 'Pendiente';
  responsables: Array<{ nombre: string; rol: string }>;
  notas?: string;
}

interface AgendaChecklistItem {
  titulo: string;
  detalles: string;
  completado: boolean;
}

@Component({
  selector: 'app-agenda-operativa',
  templateUrl: './agenda-operativa.component.html',
  styleUrls: ['./agenda-operativa.component.css']
})
export class AgendaOperativaComponent {
  fechaSeleccionada = new Date();

  readonly resumen: AgendaResumenItem[] = [
    {
      titulo: 'Eventos hoy',
      valor: '3',
      icono: 'event_available',
      descripcion: '2 producciones en ejecución y 1 por iniciar',
      tema: 'primary'
    },
    {
      titulo: 'Personal asignado',
      valor: '12/15',
      icono: 'group',
      descripcion: '80% del staff operativo confirmado',
      tema: 'success'
    },
    {
      titulo: 'Alertas logísticas',
      valor: '2',
      icono: 'warning_amber',
      descripcion: 'Traslados pendientes de confirmación',
      tema: 'warning'
    }
  ];

  readonly eventosDelDia: AgendaEvento[] = [
    {
      titulo: 'Boda María & Sergio',
      cliente: 'Sergio Calderón',
      fecha: '10:30',
      hora: 'Todo el día',
      ubicacion: 'La Hacienda, Pachacámac',
      estado: 'En curso',
      responsables: [
        { nombre: 'Laura Méndez', rol: 'Coordinadora' },
        { nombre: 'Diego Flores', rol: 'Director de fotografía' }
      ],
      notas: 'Llegar 60 min antes para montaje de iluminación.'
    },
    {
      titulo: 'Lanzamiento producto Futura',
      cliente: 'Futura Labs',
      fecha: '13:00',
      hora: '14:30 - 20:00',
      ubicacion: 'Auditorio Futura, Miraflores',
      estado: 'Programado',
      responsables: [
        { nombre: 'Ana Jiménez', rol: 'Productora' },
        { nombre: 'Equipo B', rol: 'Cámaras y audio' }
      ],
      notas: 'Confirmar transmisión streaming una hora antes.'
    },
    {
      titulo: 'Sesión corporativa',
      cliente: 'Banco Andino',
      fecha: '18:00',
      hora: '18:00 - 21:00',
      ubicacion: 'Oficinas Banco Andino, San Isidro',
      estado: 'Pendiente',
      responsables: [
        { nombre: 'Marcos Ruiz', rol: 'Fotógrafo' },
        { nombre: 'Soporte C', rol: 'Backstage' }
      ]
    }
  ];

  readonly checklistPrevio: AgendaChecklistItem[] = [
    {
      titulo: 'Confirmar movilidad externa',
      detalles: 'Traslado de equipo de iluminación para evento Futura',
      completado: false
    },
    {
      titulo: 'Revisar baterías y memorias',
      detalles: 'Equipo B debe reportar inventario antes de las 12:00',
      completado: true
    },
    {
      titulo: 'Compartir guion actualizado',
      detalles: 'Enviar versión V3 al equipo audiovisual',
      completado: false
    }
  ];

  readonly proximosEventos: AgendaEvento[] = [
    {
      titulo: 'Festival Gastronómico',
      cliente: 'Municipalidad de Lima',
      fecha: 'Mañana · 09:00',
      hora: '09:00 - 18:00',
      ubicacion: 'Parque de la Exposición',
      estado: 'Programado',
      responsables: [
        { nombre: 'Equipo A', rol: 'Cobertura integral' }
      ],
      notas: 'Requiere cobertura 360° y dron.'
    },
    {
      titulo: 'Graduación UPC',
      cliente: 'UPC',
      fecha: 'Domingo · 16:00',
      hora: '16:00 - 22:00',
      ubicacion: 'Centro de Convenciones, San Borja',
      estado: 'Programado',
      responsables: [
        { nombre: 'Camila Suárez', rol: 'Coordinadora' }
      ]
    }
  ];
}
