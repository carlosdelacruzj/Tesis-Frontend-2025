import { Component } from '@angular/core';

type TrendDirection = 'up' | 'down' | 'flat';

interface DashboardSummaryCard {
  id: string;
  title: string;
  value: string;
  period: string;
  change: string;
  subtitle: string;
  trend: TrendDirection;
  accent: string;
}

type DashboardStatusClass =
  | 'status-success'
  | 'status-warning'
  | 'status-info'
  | 'status-neutral'
  | 'status-risk';

interface DashboardEvent {
  dateLabel: string;
  title: string;
  type: string;
  location: string;
  crewLead: string;
  status: string;
  statusClass: DashboardStatusClass;
}

interface ProjectPipeline {
  name: string;
  progress: number;
  stage: string;
  due: string;
  owner: string;
}

interface Deliverable {
  title: string;
  client: string;
  due: string;
  status: string;
  owner: string;
}

interface EquipmentUtilization {
  id: string;
  label: string;
  utilization: number;
  detail: string;
  availability: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  owner: string;
  due: string;
  done: boolean;
}

interface SalesSource {
  channel: string;
  contribution: string;
  trend: TrendDirection;
  note: string;
}

interface AgendaHighlight {
  label: string;
  value: string;
  detail: string;
  icon: string;
  theme: 'primary' | 'success' | 'warning';
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  readonly dashboardMeta = {
    studioName: 'Nova Memories',
    weekRange: '13 al 19 Ene 2025',
    lastUpdate: 'Actualizado hace 2h'
  };

  readonly summaryCards: DashboardSummaryCard[] = [
    {
      id: 'bookings',
      title: 'Eventos confirmados',
      value: '12',
      period: 'Enero',
      change: '+3 reservas',
      subtitle: 'vs. mes anterior',
      trend: 'up',
      accent: 'accent-sand'
    },
    {
      id: 'revenue',
      title: 'Ingresos proyectados',
      value: '$86,500',
      period: 'Q1',
      change: '+18%',
      subtitle: 'pipeline asegurado',
      trend: 'up',
      accent: 'accent-sky'
    },
    {
      id: 'avg-ticket',
      title: 'Ticket promedio',
      value: '$7,210',
      period: 'Últimos 30 días',
      change: '+$540',
      subtitle: 'por experiencias premium',
      trend: 'up',
      accent: 'accent-rose'
    },
    {
      id: 'nps',
      title: 'NPS clientes',
      value: '72',
      period: 'Trimestre actual',
      change: '+4 pts',
      subtitle: 'mejora vs. T4',
      trend: 'up',
      accent: 'accent-forest'
    }
  ];

  readonly upcomingEvents: DashboardEvent[] = [
    {
      dateLabel: 'Vie 17 Ene',
      title: 'Mendoza & Salazar',
      type: 'Boda',
      location: 'Hacienda Santa Ana',
      crewLead: 'Valeria Soto',
      status: 'Pre-producción',
      statusClass: 'status-warning'
    },
    {
      dateLabel: 'Sáb 18 Ene',
      title: 'InnoTech Summit',
      type: 'Corporativo',
      location: 'Centro de Convenciones',
      crewLead: 'Diego Huamán',
      status: 'Confirmado',
      statusClass: 'status-success'
    },
    {
      dateLabel: 'Dom 19 Ene',
      title: 'Quinceañera Arlette F.',
      type: 'Social',
      location: 'Casa Prado',
      crewLead: 'Lucía Ramos',
      status: 'Rodaje',
      statusClass: 'status-info'
    },
    {
      dateLabel: 'Lun 20 Ene',
      title: 'Nativa Café',
      type: 'Branding',
      location: 'San Isidro',
      crewLead: 'Marcos Paredes',
      status: 'Brief en revisión',
      statusClass: 'status-neutral'
    }
  ];

  readonly agendaHighlights: AgendaHighlight[] = [
    {
      label: 'Eventos hoy',
      value: '3',
      detail: '1 pendiente de inicio',
      icon: 'event_available',
      theme: 'primary'
    },
    {
      label: 'Staff asignado',
      value: '12 / 15',
      detail: '80% confirmado',
      icon: 'group',
      theme: 'success'
    },
    {
      label: 'Alertas logísticas',
      value: '2',
      detail: 'Traslado y streaming',
      icon: 'notification_important',
      theme: 'warning'
    }
  ];

  readonly projectPipelines: ProjectPipeline[] = [
    {
      name: 'Edición Boda Torres',
      progress: 68,
      stage: 'Highlight en revisión',
      due: '23 Ene',
      owner: 'L. Ramos'
    },
    {
      name: 'Post InnoTech Summit',
      progress: 40,
      stage: 'Corrección de color',
      due: '28 Ene',
      owner: 'D. Huamán'
    },
    {
      name: 'Álbum Valdez',
      progress: 85,
      stage: 'Aprobación cliente',
      due: '19 Ene',
      owner: 'M. Paredes'
    }
  ];

  readonly deliverables: Deliverable[] = [
    {
      title: 'Preview boda Matos',
      client: 'Matos & Benavides',
      due: '12 Ene',
      status: 'Enviar link privado',
      owner: 'Valeria'
    },
    {
      title: 'Contrato firma pendiente',
      client: 'Corporativo InnoTech',
      due: 'Hoy',
      status: 'Firmas digitales',
      owner: 'Rocío'
    },
    {
      title: 'Plan de cobertura',
      client: 'Quince Arlette F.',
      due: '14 Ene',
      status: 'Validación de padres',
      owner: 'Marcos'
    }
  ];

  readonly equipmentUtilization: EquipmentUtilization[] = [
    {
      id: 'cam',
      label: 'Cámaras mirrorless',
      utilization: 82,
      detail: 'Sony A7SIII (8/10 en uso)',
      availability: '2 unidades libres'
    },
    {
      id: 'light',
      label: 'Iluminación',
      utilization: 45,
      detail: 'Kits Aputure 120d',
      availability: 'Disponible para reservas'
    },
    {
      id: 'drone',
      label: 'Drones',
      utilization: 67,
      detail: 'Mavic 3 (2/3 en ruta)',
      availability: '1 disponible viernes'
    }
  ];

  readonly checklist: ChecklistItem[] = [
    {
      id: 'task-1',
      label: 'Confirmar logística con Hacienda Santa Ana',
      owner: 'Producción',
      due: 'Jue 16 Ene',
      done: false
    },
    {
      id: 'task-2',
      label: 'Enviar moodboard a Nativa Café',
      owner: 'Creativo',
      due: 'Hoy',
      done: false
    },
    {
      id: 'task-3',
      label: 'Actualizar CRM post evento Torres',
      owner: 'Comercial',
      due: 'Ayer',
      done: true
    }
  ];

  readonly salesSources: SalesSource[] = [
    {
      channel: 'Referencias de clientes',
      contribution: '42%',
      trend: 'up',
      note: '+6% vs. promedio'
    },
    {
      channel: 'Redes sociales (IG/TikTok)',
      contribution: '31%',
      trend: 'up',
      note: 'Campaña "Historias reales"'
    },
    {
      channel: 'Google Ads',
      contribution: '18%',
      trend: 'flat',
      note: 'CPC estable'
    },
    {
      channel: 'Aliados planners',
      contribution: '9%',
      trend: 'down',
      note: 'Requiere activación'
    }
  ];
}
