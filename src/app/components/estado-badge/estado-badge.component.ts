import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

type EstadoValue = string | number | null | undefined;

@Component({
  selector: 'app-estado-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estado-badge.component.html',
  styleUrls: ['./estado-badge.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstadoBadgeComponent {
  @Input() estado: EstadoValue = null;
  @Input() mapaColores?: Record<string | number, string>;

  private readonly defaultMapa: Record<string, string> = {
    // Cotizaciones
    borrador: 'neutral',
    enviada: 'info',
    aceptada: 'success',
    rechazada: 'danger',
    // Pedidos
    cotizado: 'neutral',
    contratado: 'info',
    'en ejecucion': 'warning',
    'en ejecución': 'warning',
    entregado: 'success-light',
    cerrado: 'success',
    cancelado: 'danger'
  };

  get label(): string {
    if (this.estado === null || this.estado === undefined) return 'Sin estado';
    const text = String(this.estado).trim();
    return text || 'Sin estado';
  }

  get classes(): string[] {
    const colorKey = this.resolveColorKey();
    const className = this.resolveClassName(colorKey);
    return ['estado-badge', className];
  }

  get customStyle(): Record<string, string> {
    const colorKey = this.resolveColorKey();
    if (!colorKey?.startsWith('#')) {
      return {};
    }
    return {
      backgroundColor: colorKey,
      color: '#fff',
      borderColor: colorKey
    };
  }

  private normalize(valor: EstadoValue): string {
    if (valor === null || valor === undefined) return '';
    return String(valor).trim().toLowerCase();
  }

  private resolveColorKey(): string {
    const estadoKey = this.normalize(this.estado);
    if (!estadoKey) return 'neutral';

    if (this.mapaColores) {
      let match = this.mapaColores[estadoKey];
      if (!match && (typeof this.estado === 'string' || typeof this.estado === 'number')) {
        match = this.mapaColores[this.estado];
      }
      if (match) return match;
    }

    return this.defaultMapa[estadoKey] ?? 'neutral';
  }

  private resolveClassName(colorKey: string): string {
    if (colorKey.startsWith('#')) {
      return 'estado-custom';
    }
    switch (colorKey) {
      case 'primary': return 'estado-primary';
      case 'info': return 'estado-info';
      case 'success': return 'estado-success';
      case 'success-light': return 'estado-success-light';
      case 'warning': return 'estado-warning';
      case 'danger': return 'estado-danger';
      case 'neutral':
      default:
        return 'estado-neutral';
    }
  }
}
