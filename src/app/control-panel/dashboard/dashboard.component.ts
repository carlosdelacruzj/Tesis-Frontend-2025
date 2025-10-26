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
    studioName: 'Foto D la Cruz',
    weekRange: '13 al 19 Ene 2025',
    lastUpdate: 'Actualizado hace 2h'
  };

  readonly summaryCards: DashboardSummaryCard[] = [
    {
      id: 'agenda-today',
      title: 'Eventos en agenda',
      value: '3 eventos',
      period: 'Hoy',
      change: '1 en montaje',
      subtitle: 'Actualización diaria',
      trend: 'up',
      accent: 'accent-sand'
    },
    {
      id: 'crew-coverage',
      title: 'Cobertura de crew',
      value: '12 / 15',
      period: 'Turno de hoy',
      change: '3 por confirmar',
      subtitle: 'Coordinación operativa',
      trend: 'flat',
      accent: 'accent-sky'
    },
    {
      id: 'critical-tasks',
      title: 'Tareas críticas',
      value: '2 tareas',
      period: 'Próximas 24h',
      change: '1 completada hoy',
      subtitle: 'Checklist inmediato',
      trend: 'flat',
      accent: 'accent-rose'
    },
    {
      id: 'equipment-usage',
      title: 'Utilización equipos',
      value: '82%',
      period: 'Sesiones de hoy',
      change: '2 unidades libres',
      subtitle: 'Ver detalle por categoría',
      trend: 'flat',
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
      label: 'Primera llamada',
      value: '07:00',
      detail: 'Montaje InnoTech Summit',
      icon: 'alarm',
      theme: 'primary'
    },
    {
      label: 'Eventos hoy',
      value: '3',
      detail: '1 en montaje · 2 en rodaje',
      icon: 'event_available',
      theme: 'success'
    },
  {
      label: 'Alertas logísticas',
      value: '2',
      detail: 'Traslado drone · Clima playa',
      icon: 'warning_amber',
      theme: 'warning'
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
