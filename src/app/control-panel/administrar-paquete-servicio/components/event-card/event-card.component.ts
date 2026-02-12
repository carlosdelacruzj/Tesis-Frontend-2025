// event-card.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { corregirCumple } from 'src/app/shared/utils/text-utils';
const BASE_IMG = 'assets/images';
const DEFAULT_IMG = `${BASE_IMG}/default.jpg`;

@Component({
  selector: 'app-event-card',
  templateUrl: './event-card.component.html',
  styleUrls: ['./event-card.component.css'],
})
export class EventCardComponent {
  @Input() id!: number;
  @Input() titulo = '';
  @Input() imagen = ''; // puede venir vacío, filename o URL absoluta
  @Output() emitAccion = new EventEmitter<number>();
  corregirCumple = corregirCumple;
  resolveSrc(src: string): string {
    if (!src) return DEFAULT_IMG;

    const s = src.trim();

    // Si ya es URL absoluta o ya empieza en assets/, úsalo tal cual
    if (/^https?:\/\//i.test(s) || s.startsWith('assets/')) return s;

    // Si viene con subcarpetas antiguas (ej. img/eventos/loquesea.jpg),
    // nos quedamos con el filename final
    const file = s.split('/').pop() || s;

    // Fuerza a nuestra carpeta real
    return `${BASE_IMG}/${file}`;
  }

  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;

    // Evita bucles: si ya pusimos el fallback, no hagas nada
    if (img.dataset.fallback === '1') return;

    img.src = 'assets/images/default.jpg'; // tu placeholder
    img.dataset.fallback = '1';
  }

  cambioVista() {
    this.emitAccion.emit(this.id);
  }
}
