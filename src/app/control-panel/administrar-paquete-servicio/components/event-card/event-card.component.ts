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
  @Input() imagen = '';
  @Output() emitAccion = new EventEmitter<number>();
  @Output() emitEditar = new EventEmitter<number>();

  corregirCumple = corregirCumple;

  resolveSrc(src: string): string {
    if (!src) return DEFAULT_IMG;

    const s = src.trim();
    if (/^https?:\/\//i.test(s) || s.startsWith('assets/')) return s;

    const file = s.split('/').pop() || s;
    return `${BASE_IMG}/${file}`;
  }

  onImgError(ev: Event): void {
    const img = ev.target as HTMLImageElement;
    if (img.dataset.fallback === '1') return;

    img.src = 'assets/images/default.jpg';
    img.dataset.fallback = '1';
  }

  cambioVista(): void {
    this.emitAccion.emit(this.id);
  }

  editar(event: Event): void {
    event.stopPropagation();
    this.emitEditar.emit(this.id);
  }
}

