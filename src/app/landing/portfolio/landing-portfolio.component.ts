import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, take, takeUntil } from 'rxjs/operators';
import { LandingPortafolioService, PortafolioPublicoEvento } from '../services';

interface PortfolioItem {
  id: string;
  type: string;
  title: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  source: string;
  poster?: string;
  orden?: number | null;
  fechaCreacion?: string | null;
}

interface PortfolioCategory {
  name: string;
  items: PortfolioItem[];
  preview: PortfolioItem[];
  total: number;
}

@Component({
  selector: 'app-landing-portfolio',
  templateUrl: './landing-portfolio.component.html',
  styleUrls: ['./landing-portfolio.component.css']
})
export class LandingPortfolioComponent implements OnInit, OnDestroy {
  portfolio: PortfolioItem[] = [];
  portfolioCategories: PortfolioCategory[] = [];
  portfolioTotalImages = 0;
  portfolioTotalCategories = 0;
  portfolioLoading = false;
  portfolioError: string | null = null;

  selectedLightboxItem: PortfolioItem | null = null;
  selectedCategory: string | null = null;
  galleryPage = 1;
  readonly galleryPageSize = 12;

  @ViewChild('categoryTrack', { static: false }) private categoryTrack?: ElementRef<HTMLDivElement>;
  categoryAtStart = true;
  categoryAtEnd = false;

  private readonly destroy$ = new Subject<void>();
  private readonly portafolioService = inject(LandingPortafolioService);
  private readonly portfolioAssetBase = this.getPortfolioAssetBase();

  ngOnInit(): void {
    this.loadPortfolioPublico();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateCategoryBounds();
  }

  get canScrollCategories(): boolean {
    const track = this.categoryTrack?.nativeElement;
    if (!track) return false;
    return track.scrollWidth > track.clientWidth + 4;
  }

  get carouselCategories(): PortfolioCategory[] {
    return this.portfolioCategories;
  }

  get selectedCategoryItems(): PortfolioItem[] {
    if (!this.selectedCategory) return [];
    return this.portfolio.filter(item => item.type === this.selectedCategory);
  }

  get pagedCategoryItems(): PortfolioItem[] {
    const start = (this.galleryPage - 1) * this.galleryPageSize;
    return this.selectedCategoryItems.slice(start, start + this.galleryPageSize);
  }

  get galleryTotalPages(): number {
    return Math.max(1, Math.ceil(this.selectedCategoryItems.length / this.galleryPageSize));
  }

  openLightbox(item: PortfolioItem): void {
    this.selectedLightboxItem = item;
    this.trackEvent('portfolio_view', { id: item.id });
  }

  closeLightbox(): void {
    this.selectedLightboxItem = null;
  }

  openCategory(nombre: string): void {
    this.selectedCategory = nombre;
    this.galleryPage = 1;
    this.trackEvent('portfolio_view', { category: nombre });
  }

  closeCategory(): void {
    this.selectedCategory = null;
    this.galleryPage = 1;
  }

  nextGalleryPage(): void {
    if (this.galleryPage < this.galleryTotalPages) {
      this.galleryPage += 1;
    }
  }

  prevGalleryPage(): void {
    if (this.galleryPage > 1) {
      this.galleryPage -= 1;
    }
  }

  scrollCategoryNext(): void {
    const track = this.categoryTrack?.nativeElement;
    if (!track) return;
    const step = this.getCategoryScrollStep(track);
    if (!step) return;
    track.scrollBy({ left: step, behavior: 'smooth' });
    setTimeout(() => this.updateCategoryBounds(), 350);
  }

  scrollCategoryPrev(): void {
    const track = this.categoryTrack?.nativeElement;
    if (!track) return;
    const step = this.getCategoryScrollStep(track);
    if (!step) return;
    track.scrollBy({ left: -step, behavior: 'smooth' });
    setTimeout(() => this.updateCategoryBounds(), 350);
  }

  onCategoryScroll(): void {
    this.updateCategoryBounds();
  }

  private loadPortfolioPublico(): void {
    this.portfolioLoading = true;
    this.portfolioError = null;
    this.portafolioService.getPortafolioPublico()
      .pipe(
        take(1),
        catchError(err => {
          console.error('[landing] portafolio', err);
          this.portfolioError = 'No pudimos cargar el portafolio.';
          this.portfolio = [];
          this.portfolioCategories = [];
          this.portfolioTotalImages = 0;
          this.portfolioTotalCategories = 0;
          this.portfolioLoading = false;
          return of([] as PortafolioPublicoEvento[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(eventos => {
        const listado = Array.isArray(eventos) ? eventos : [];
        this.portfolio = this.mapPortfolioItems(listado);
        this.portfolioCategories = this.mapPortfolioCategories(this.portfolio);
        this.portfolioTotalImages = this.portfolio.length;
        this.portfolioTotalCategories = this.portfolioCategories.length;
        if (this.selectedCategory && !this.portfolioCategories.find(cat => cat.name === this.selectedCategory)) {
          this.selectedCategory = null;
        }
        if (!this.selectedCategory && this.portfolioCategories.length > 0) {
          this.selectedCategory = this.portfolioCategories[0].name;
          this.galleryPage = 1;
        }
        this.portfolioLoading = false;
        this.resetCategoryScroll();
        setTimeout(() => this.updateCategoryBounds(), 0);
      });
  }

  private mapPortfolioItems(eventos: PortafolioPublicoEvento[]): PortfolioItem[] {
    const items: PortfolioItem[] = [];
    eventos.forEach(evento => {
      (evento.imagenes ?? []).forEach(imagen => {
        const title = imagen.titulo?.trim() || imagen.descripcion?.trim() || evento.nombre;
        const url = this.resolvePortfolioUrl(imagen.url);
        items.push({
          id: `${evento.id}-${imagen.id}`,
          type: evento.nombre,
          title,
          thumbnail: url,
          mediaType: 'image',
          source: url,
          orden: imagen.orden ?? null,
          fechaCreacion: imagen.fechaCreacion ?? null
        });
      });
    });
    return items.sort((a, b) => {
      const typeCmp = a.type.localeCompare(b.type);
      if (typeCmp !== 0) return typeCmp;
      const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
      const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.title.localeCompare(b.title);
    });
  }

  private mapPortfolioCategories(items: PortfolioItem[]): PortfolioCategory[] {
    const grouped = new Map<string, PortfolioItem[]>();
    items.forEach(item => {
      if (!grouped.has(item.type)) {
        grouped.set(item.type, []);
      }
      grouped.get(item.type)!.push(item);
    });
    return Array.from(grouped.entries()).map(([name, list]) => ({
      name,
      items: list.slice().sort((a, b) => {
        const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
        const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
        if (ordenA !== ordenB) return ordenA - ordenB;
        return a.title.localeCompare(b.title);
      }),
      preview: list.slice().sort((a, b) => {
        const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
        const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
        if (ordenA !== ordenB) return ordenA - ordenB;
        return a.title.localeCompare(b.title);
      }).slice(0, 3),
      total: list.length
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private resolvePortfolioUrl(path?: string | null): string {
    if (!path) return 'assets/images/default.jpg';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('assets/')) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.portfolioAssetBase}${normalized}`;
  }

  private getPortfolioAssetBase(): string {
    try {
      return new URL(this.portafolioService.baseUrl).origin;
    } catch (error) {
      console.warn('[landing] baseUrl invalida, usando fallback', error);
      return this.portafolioService.baseUrl.replace(/\/api\/v1\/?$/, '');
    }
  }

  private getCategoryScrollStep(track: HTMLDivElement): number {
    const card = track.querySelector<HTMLElement>('.portfolio__category');
    if (!card) return 0;
    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    return card.offsetWidth + gap;
  }

  private resetCategoryScroll(): void {
    const track = this.categoryTrack?.nativeElement;
    if (!track) return;
    track.scrollLeft = 0;
    this.updateCategoryBounds();
  }

  private updateCategoryBounds(): void {
    const track = this.categoryTrack?.nativeElement;
    if (!track) {
      this.categoryAtStart = true;
      this.categoryAtEnd = false;
      return;
    }
    const maxScroll = track.scrollWidth - track.clientWidth;
    this.categoryAtStart = track.scrollLeft <= 4;
    this.categoryAtEnd = track.scrollLeft >= maxScroll - 4;
  }

  private trackEvent(eventName: string, params?: Record<string, unknown>): void {
    const win = window as Window & { dataLayer?: Record<string, unknown>[] };
    if (win && Array.isArray(win.dataLayer)) {
      win.dataLayer.push({ event: eventName, ...(params ?? {}) });
    }
  }
}
