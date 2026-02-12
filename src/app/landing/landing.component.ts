import {
  Component,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  HostListener,
  ElementRef,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  Validators,
  FormGroupDirective,
  ValidationErrors,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, take, takeUntil } from 'rxjs/operators';
import {
  DateInput,
  formatDisplayDate,
  formatIsoDate,
  parseDateInput,
} from '../shared/utils/date-utils';
import {
  LandingCotizacionService,
  LandingEventDto,
  LandingPublicCotizacionPayload,
  LandingPortafolioService,
  PortafolioPublicoEvento,
} from './services';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

// Landing copy decks for cards and sections
interface LandingServiceCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  bullets: string[];
}

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

interface PackageTier {
  id: string;
  name: string;
  priceFrom: string;
  hours: string;
  photos: string;
  video: string;
  delivery: string;
  addons: string[];
  highlight?: boolean;
  recommendedFor: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface LandingEventOption {
  id: number | null;
  name: string;
}

const FALLBACK_EVENT_OPTIONS: LandingEventOption[] = [
  { id: null, name: 'Boda' },
  { id: null, name: 'Cumpleaños' },
  { id: null, name: 'Corporativo' },
];

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly currentYear = new Date().getFullYear();

  // Micro-copy rendered on the hero badges
  readonly heroBadges = [
    { label: '★ 4.9/5', caption: 'Reseñas verificadas' },
    { label: '+320', caption: 'Proyectos realizados' },
    { label: '12 años', caption: 'Capturando historias' },
  ];

  // Service catalog displayed in the first section
  readonly services: LandingServiceCard[] = [
    {
      id: 'bodas',
      icon: 'fa-solid fa-church',
      title: 'Bodas',
      description: 'Cobertura integral para ceremonia, recepción y fiesta.',
      bullets: [
        'Sesión pre-boda incluida',
        'Video highlight de 3 minutos',
        'Entrega en galería privada',
      ],
    },
    {
      id: 'eventos',
      icon: 'fa-regular fa-chess-knight ',
      title: 'Eventos Sociales',
      description:
        'Fiestas, aniversarios y celebraciones especiales en Lima y provincias.',
      bullets: [
        'Cobertura flexible desde 2 horas',
        'Video resumen para redes sociales',
        'Equipo compacto y discreto',
      ],
    },
    {
      id: 'corporativo',
      icon: 'fa-regular fa-building',
      title: 'Corporativo',
      description:
        'Eventos empresariales, lanzamientos y branding audiovisual.',
      bullets: [
        'Cobertura multi-cámara',
        'Testimoniales y backstage',
        'Entrega express 48h',
      ],
    },
    {
      id: 'comunion',
      icon: 'fa-solid fa-cross',
      title: 'Comuniones',
      description:
        'Reportaje íntimo de ceremonias de primera comunión y celebraciones familiares.',
      bullets: [
        'Cobertura en iglesia y recepción',
        'Retratos familiares dirigidos',
        'Galería lista en 5 días',
      ],
    },
    {
      id: 'barmitzva',
      icon: 'fa-solid fa-book-tanakh',
      title: 'Bar/Bat Mitzvá',
      description:
        'Cobertura respetuosa y creativa de ceremonias judías y celebraciones temáticas.',
      bullets: [
        'Captura de rituales y tradiciones',
        'Equipo bilingüe disponible',
        'Edición con versiones para redes',
      ],
    },
    {
      id: 'quinceanera',
      icon: 'fa-solid fa-crown',
      title: 'Quinceañera',
      description:
        'Cobertura artística para sesiones previas y fiesta central.',
      bullets: [
        'Sesión temática personalizada',
        'Libro premium en 15 días',
        'Drone y segundo fotógrafo opcional',
      ],
    },
  ];

  portfolio: PortfolioItem[] = [];
  portfolioCategories: PortfolioCategory[] = [];
  portfolioTotalImages = 0;
  portfolioTotalCategories = 0;
  portfolioLoading = false;
  portfolioError: string | null = null;

  // Pricing tiers surfaced in “Paquetes”
  readonly packages: PackageTier[] = [
    {
      id: 'esencial',
      name: 'Esencial',
      priceFrom: 'Desde US$ 890',
      hours: 'Cobertura 3 horas',
      photos: '120 fotos editadas',
      video: 'Video highlight 60s',
      delivery: 'Galería privada 5 días',
      addons: ['Drone', '2º fotógrafo', 'Impresiones fine art'],
      recommendedFor: 'Eventos íntimos y celebraciones familiares',
    },
    {
      id: 'signature',
      name: 'Signature',
      priceFrom: 'Desde US$ 1,650',
      hours: 'Cobertura 6 horas',
      photos: '220 fotos editadas',
      video: 'Video highlight 3 min',
      delivery: 'USB + galería privada 7 días',
      addons: ['Drone', 'Live streaming', 'Reels verticales'],
      highlight: true,
      recommendedFor: 'Bodas civiles, quinceañeras y eventos corporativos',
    },
    {
      id: 'premium',
      name: 'Premium',
      priceFrom: 'Desde US$ 2,400',
      hours: 'Cobertura full day',
      photos: '350 fotos editadas',
      video: 'Documental 8 min + highlight',
      delivery: 'Álbum artesanal + backup 1 año',
      addons: ['Drone', 'Equipo documental extra', 'Entrega express 72h'],
      recommendedFor: 'Bodas destino y producciones de alto impacto',
    },
  ];

  // FAQ entries for the accordion
  readonly faqs: FaqItem[] = [
    {
      question: '¿Cómo funcionan las entregas y revisiones?',
      answer:
        'Entregamos una galería preliminar en 5-7 días hábiles y ofrecemos hasta 2 rondas de ajustes sin costo.',
    },
    {
      question: '¿Requieren adelanto para reservar la fecha?',
      answer:
        'Sí, se reserva con el 30% del paquete contratado. El saldo se cancela el día del evento.',
    },
    {
      question: '¿Cubren eventos fuera de Lima?',
      answer:
        'Sí, viajamos a todo el Perú. Se cotizan viáticos y logística según destino.',
    },
    {
      question: '¿Puedo agregar un segundo fotógrafo o drone?',
      answer:
        'Claro, contamos con operadores certificados para drone y un pool de fotógrafos adicionales.',
    },
    {
      question: '¿Puedo solicitar archivos RAW o uso comercial?',
      answer:
        'Sí. Los RAW se entregan bajo acuerdo y aplican tarifas adicionales según licencia de uso.',
    },
    {
      question: '¿Qué pasa si cambia la fecha?',
      answer:
        'Podemos reprogramar sin penalidad hasta 45 días antes. Luego, aplican cargos por bloqueo de agenda.',
    },
  ];

  // Optional extras rendered as checkboxes
  readonly extrasCatalog = [
    {
      control: 'drone',
      label: 'Drone 4K',
      description: 'Piloto certificado DGAC',
    },
    {
      control: 'segundoFotografo',
      label: 'Segundo fotógrafo',
      description: 'Cobertura multiángulo',
    },
    {
      control: 'entregaExpress',
      label: 'Entrega exprés',
      description: 'Galería en 72 horas',
    },
    {
      control: 'album',
      label: 'Álbum físico',
      description: 'Libro fotográfico de 30 páginas',
    },
  ];

  readonly sourceOptions = [
    'Recomendación',
    'Instagram',
    'TikTok',
    'Google',
    'Evento en vivo',
    'Otro',
  ];
  readonly departamentos: string[] = [
    'Amazonas',
    'Ancash',
    'Apurimac',
    'Arequipa',
    'Ayacucho',
    'Cajamarca',
    'Callao',
    'Cusco',
    'Huancavelica',
    'Huanuco',
    'Ica',
    'Junin',
    'La Libertad',
    'Lambayeque',
    'Lima',
    'Loreto',
    'Madre de Dios',
    'Moquegua',
    'Pasco',
    'Piura',
    'Puno',
    'San Martin',
    'Tacna',
    'Tumbes',
    'Ucayali',
  ];

  eventOptions: LandingEventOption[] = FALLBACK_EVENT_OPTIONS;
  eventCatalogReady = false;
  readonly minQuoteDate = this.addDays(this.startOfToday(), 1);
  readonly maxQuoteDate = this.addMonths(this.startOfToday(), 6);

  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cotizacionService = inject(LandingCotizacionService);
  private readonly route = inject(ActivatedRoute);

  readonly quoteForm = this.fb.group({
    nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
    whatsappNumero: [
      '',
      [Validators.required, Validators.pattern(/^\d{6,15}$/)],
    ],
    tipoEvento: ['', Validators.required],
    eventoId: [null],
    fechaEvento: [
      null,
      [Validators.required, this.fechaEventoEnRangoValidator()],
    ],
    departamento: ['', Validators.required],
    mensaje: [''],
    dias: [
      null,
      [Validators.required, Validators.pattern(/^\d+$/), Validators.min(1)],
    ],
    horas: [
      { value: '', disabled: true },
      [Validators.required, this.horasValidator.bind(this)],
    ],
    invitados: [''],
    presupuesto: [50],
    extras: this.fb.group({
      drone: [false],
      segundoFotografo: [false],
      entregaExpress: [false],
      album: [false],
    }),
    comoNosConociste: [''],
    consentimiento: [false, Validators.requiredTrue],
  });

  submissionSuccess = false;
  isSubmitting = false;
  quoteStarted = false;
  whatsAppLink: string | null = null;
  selectedLightboxItem: PortfolioItem | null = null;
  selectedCategory: string | null = null;
  galleryPage = 1;
  readonly galleryPageSize = 12;
  selectedPackageId: string | null = null;

  readonly localBusinessSchema = this.createSchemaScript({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: "D' La Cruz video y fotografía",
    image: 'https://example.com/logo.webp',
    url: 'https://dlacruz.pe',
    telephone: '+51 999 999 999',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Av. Primavera 123',
      addressLocality: 'Lima',
      addressRegion: 'Lima',
      postalCode: '15023',
      addressCountry: 'PE',
    },
    openingHours: 'Mo-Su 09:00-21:00',
    priceRange: '$$',
    sameAs: [
      'https://www.facebook.com/dlacruz',
      'https://www.instagram.com/dlacruz',
      'https://www.tiktok.com/@dlacruz',
    ],
  });

  readonly faqSchema = this.createSchemaScript({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: this.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  });

  private readonly destroy$ = new Subject<void>();
  @ViewChild(FormGroupDirective, { static: false })
  private quoteFormDirective?: FormGroupDirective;
  @ViewChild('categoryTrack', { static: false })
  private categoryTrack?: ElementRef<HTMLDivElement>;
  @ViewChild('serviceTrack', { static: false })
  private serviceTrack?: ElementRef<HTMLDivElement>;
  private readonly portafolioService = inject(LandingPortafolioService);
  private readonly portfolioAssetBase = this.getPortfolioAssetBase();
  categoryAtStart = true;
  categoryAtEnd = false;
  serviceAtStart = true;
  serviceAtEnd = false;
  private serviceAutoScrollId: number | null = null;

  ngOnInit(): void {
    this.loadEventOptions();
    this.resetServiceScroll();
    this.route.fragment.pipe(takeUntil(this.destroy$)).subscribe((fragment) => {
      if (fragment) {
        setTimeout(() => this.scrollToSection(fragment), 0);
      }
    });
    this.quoteForm
      .get('dias')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => this.syncHorasControl(value));
  }

  // Marks the quote as started once any field is focused
  handleQuoteStart(): void {
    if (!this.quoteStarted) {
      this.quoteStarted = true;
      this.trackEvent('quote_start');
    }
  }

  // Opens the lightbox modal for portfolio items
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

  get canScrollCategories(): boolean {
    const track = this.categoryTrack?.nativeElement;
    if (!track) return false;
    return track.scrollWidth > track.clientWidth + 4;
  }

  get canScrollServices(): boolean {
    const track = this.serviceTrack?.nativeElement;
    if (!track) return false;
    return track.scrollWidth > track.clientWidth + 4;
  }

  get carouselCategories(): PortfolioCategory[] {
    return this.portfolioCategories;
  }

  get selectedCategoryItems(): PortfolioItem[] {
    if (!this.selectedCategory) return [];
    return this.portfolio.filter((item) => item.type === this.selectedCategory);
  }

  get pagedCategoryItems(): PortfolioItem[] {
    const start = (this.galleryPage - 1) * this.galleryPageSize;
    return this.selectedCategoryItems.slice(
      start,
      start + this.galleryPageSize,
    );
  }

  get galleryTotalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.selectedCategoryItems.length / this.galleryPageSize),
    );
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

  private loadPortfolioPublico(): void {
    this.portfolioLoading = true;
    this.portfolioError = null;
    this.portafolioService
      .getPortafolioPublico()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (eventos) => {
          const listado = Array.isArray(eventos) ? eventos : [];
          this.portfolio = this.mapPortfolioItems(listado);
          this.portfolioCategories = this.mapPortfolioCategories(
            this.portfolio,
          );
          this.portfolioTotalImages = this.portfolio.length;
          this.portfolioTotalCategories = this.portfolioCategories.length;
          if (
            this.selectedCategory &&
            !this.portfolioCategories.find(
              (cat) => cat.name === this.selectedCategory,
            )
          ) {
            this.selectedCategory = null;
          }
          this.portfolioLoading = false;
          this.resetCategoryScroll();
          this.resetServiceScroll();
          setTimeout(() => this.updateCategoryBounds(), 0);
        },
        error: (err) => {
          console.error('[landing] portafolio', err);
          this.portfolioError = 'No pudimos cargar el portafolio.';
          this.portfolio = [];
          this.portfolioCategories = [];
          this.portfolioTotalImages = 0;
          this.portfolioTotalCategories = 0;
          this.selectedCategory = null;
          this.portfolioLoading = false;
        },
      });
  }

  private mapPortfolioItems(
    eventos: PortafolioPublicoEvento[],
  ): PortfolioItem[] {
    const items: PortfolioItem[] = [];
    eventos.forEach((evento) => {
      (evento.imagenes ?? []).forEach((imagen) => {
        const title =
          imagen.titulo?.trim() || imagen.descripcion?.trim() || evento.nombre;
        const url = this.resolvePortfolioUrl(imagen.url);
        items.push({
          id: `${evento.id}-${imagen.id}`,
          type: evento.nombre,
          title,
          thumbnail: url,
          mediaType: 'image',
          source: url,
          orden: imagen.orden ?? null,
          fechaCreacion: imagen.fechaCreacion ?? null,
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
    items.forEach((item) => {
      if (!grouped.has(item.type)) {
        grouped.set(item.type, []);
      }
      grouped.get(item.type)!.push(item);
    });
    return Array.from(grouped.entries())
      .map(([name, list]) => ({
        name,
        items: list.slice().sort((a, b) => {
          const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
          const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
          if (ordenA !== ordenB) return ordenA - ordenB;
          return a.title.localeCompare(b.title);
        }),
        preview: list
          .slice()
          .sort((a, b) => {
            const ordenA = a.orden ?? Number.MAX_SAFE_INTEGER;
            const ordenB = b.orden ?? Number.MAX_SAFE_INTEGER;
            if (ordenA !== ordenB) return ordenA - ordenB;
            return a.title.localeCompare(b.title);
          })
          .slice(0, 3),
        total: list.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
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

  private getServiceScrollStep(track: HTMLDivElement): number {
    const card = track.querySelector<HTMLElement>('.service-card');
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

  private resetServiceScroll(): void {
    const track = this.serviceTrack?.nativeElement;
    if (!track) return;
    track.scrollLeft = 0;
    this.updateServiceBounds();
  }

  onCategoryScroll(): void {
    this.updateCategoryBounds();
  }

  onServiceScroll(): void {
    this.updateServiceBounds();
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

  private updateServiceBounds(): void {
    const track = this.serviceTrack?.nativeElement;
    if (!track) {
      this.serviceAtStart = true;
      this.serviceAtEnd = false;
      return;
    }
    const maxScroll = track.scrollWidth - track.clientWidth;
    this.serviceAtStart = track.scrollLeft <= 4;
    this.serviceAtEnd = track.scrollLeft >= maxScroll - 4;
  }

  scrollToSection(anchor: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    document
      .getElementById(anchor)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Prefills the form when a service card CTA is clicked
  prefillService(service: LandingServiceCard): void {
    const matchedValue = this.pickEventValue(service.title);
    this.quoteForm.patchValue({ tipoEvento: matchedValue });
    this.syncSelectedEventByName(matchedValue);
    this.selectedPackageId = null;
    this.trackEvent('cta_click', {
      source: 'service-card',
      service: service.id,
    });
    this.scrollToSection('cotizacion');
  }

  // Prefills the form when a package button is used
  prefillPackage(tier: PackageTier): void {
    this.selectedPackageId = tier.id;
    const matchedValue = this.pickEventValue(`Paquete ${tier.name}`);
    this.quoteForm.patchValue({ tipoEvento: matchedValue });
    this.syncSelectedEventByName(matchedValue);
    this.trackEvent('package_select', { package: tier.id });
    this.scrollToSection('cotizacion');
  }

  onEventSelectionChange(value: string): void {
    this.syncSelectedEventByName(value);
  }

  // Validates and sends the quote request to the API
  submitQuote(): void {
    this.handleQuoteStart();
    this.whatsAppLink = null;

    if (this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      this.snackBar.open(
        'Por favor completa los campos obligatorios.',
        'Cerrar',
        { duration: 4000 },
      );
      return;
    }

    this.isSubmitting = true;
    this.submissionSuccess = false;
    const currentEventSelection = this.quoteForm.get('tipoEvento')?.value ?? '';
    this.syncSelectedEventByName(currentEventSelection);
    const selectedEventoId = this.quoteForm.get('eventoId')?.value;
    const eventoId =
      selectedEventoId !== null &&
      selectedEventoId !== undefined &&
      selectedEventoId !== ''
        ? Number(selectedEventoId)
        : null;
    if (
      !this.eventCatalogReady ||
      !Number.isFinite(eventoId) ||
      (eventoId ?? 0) <= 0
    ) {
      this.isSubmitting = false;
      this.snackBar.open(
        'No pudimos validar el tipo de evento. Recarga la página e inténtalo nuevamente.',
        'Cerrar',
        { duration: 5000 },
      );
      return;
    }
    const formValue = this.quoteForm.getRawValue();
    const payload = this.buildCotizacionPayload(formValue);

    this.cotizacionService
      .createPublic(payload)
      .pipe(
        take(1),
        catchError((err) => {
          console.error('[landing] submitQuote', err);
          this.snackBar.open(
            'No pudimos registrar tu solicitud. Intenta nuevamente.',
            'Cerrar',
            { duration: 5000 },
          );
          return of(null);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((res) => {
        this.isSubmitting = false;
        if (!res) {
          return;
        }
        this.submissionSuccess = true;
        this.trackEvent('quote_submit', { package: this.selectedPackageId });
        this.createWhatsAppLink();
        void Swal.fire({
          icon: 'success',
          title: '¡Solicitud recibida!',
          text: 'Te contactaremos por WhatsApp en las próximas horas.',
          confirmButtonText: 'Listo',
          buttonsStyling: false,
          customClass: { confirmButton: 'btn btn-success' },
        });
        this.resetQuoteFormState();
        this.syncSelectedEventByName('');
        this.selectedPackageId = null;
      });
  }

  clickWhatsApp(source: string): void {
    this.trackEvent('whatsapp_click', { source });
  }

  // Tracks GTM events if dataLayer is present
  trackEvent(eventName: string, params?: Record<string, unknown>): void {
    const win = window as Window & { dataLayer?: Record<string, unknown>[] };
    if (win && Array.isArray(win.dataLayer)) {
      win.dataLayer.push({ event: eventName, ...(params ?? {}) });
    }
  }

  ngAfterViewInit(): void {
    this.updateCategoryBounds();
    this.updateServiceBounds();
    this.syncServiceCardHeights();
    this.startServiceAutoScroll();
  }

  ngOnDestroy(): void {
    this.stopServiceAutoScroll();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateCategoryBounds();
    this.updateServiceBounds();
    this.startServiceAutoScroll();
    this.syncServiceCardHeights();
  }

  scrollServicesNext(): void {
    const track = this.serviceTrack?.nativeElement;
    if (!track) return;
    const step = this.getServiceScrollStep(track);
    if (!step) return;
    track.scrollBy({ left: step, behavior: 'smooth' });
    setTimeout(() => this.updateServiceBounds(), 350);
  }

  scrollServicesPrev(): void {
    const track = this.serviceTrack?.nativeElement;
    if (!track) return;
    const step = this.getServiceScrollStep(track);
    if (!step) return;
    track.scrollBy({ left: -step, behavior: 'smooth' });
    setTimeout(() => this.updateServiceBounds(), 350);
  }

  private syncServiceCardHeights(): void {
    const track = this.serviceTrack?.nativeElement;
    if (!track) return;
    const cards = Array.from(
      track.querySelectorAll<HTMLElement>('.service-card'),
    );
    if (!cards.length) return;
    cards.forEach((card) => card.style.removeProperty('height'));
    const max = Math.max(
      ...cards.map((card) => card.getBoundingClientRect().height),
    );
    if (Number.isFinite(max) && max > 0) {
      cards.forEach((card) => {
        card.style.height = `${max}px`;
      });
    }
  }

  private startServiceAutoScroll(): void {
    this.stopServiceAutoScroll();
    if (!this.canScrollServices) {
      return;
    }
    this.serviceAutoScrollId = window.setInterval(() => {
      const track = this.serviceTrack?.nativeElement;
      if (!track) return;
      const step = this.getServiceScrollStep(track);
      if (!step) return;
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (track.scrollLeft >= maxScroll - 4) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: step, behavior: 'smooth' });
      }
      this.updateServiceBounds();
    }, 4500);
  }

  private stopServiceAutoScroll(): void {
    if (this.serviceAutoScrollId !== null) {
      window.clearInterval(this.serviceAutoScrollId);
      this.serviceAutoScrollId = null;
    }
  }
  // Retrieves event names for the select input
  private loadEventOptions(): void {
    this.eventCatalogReady = false;
    this.cotizacionService
      .getEventos()
      .pipe(
        take(1),
        catchError((err) => {
          console.error(
            '[LandingComponent] No se pudieron cargar eventos',
            err,
          );
          return of([]);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((events) => {
        const normalized = this.normalizeEventOptions(events);
        this.eventOptions = normalized.length
          ? normalized
          : FALLBACK_EVENT_OPTIONS;
        this.eventCatalogReady = normalized.length > 0;
        const currentEventName = this.quoteForm.get('tipoEvento')?.value ?? '';
        this.syncSelectedEventByName(currentEventName);
      });
  }
  // Builds the WhatsApp deeplink with the sanitized destination number
  private createWhatsAppLink(): void {
    const value = this.quoteForm.getRawValue();
    const service = value.tipoEvento || 'servicio de foto y video';
    const date =
      this.formatDateDisplay(value.fechaEvento) || 'fecha por definir';
    const district = value.departamento || 'Lima';
    const baseNumber = '51931764349';
    const base = `https://wa.me/${baseNumber}`;
    const message = encodeURIComponent(
      `¡Hola! Busco una cotización para ${service} el ${date} en ${district}.`,
    );
    this.whatsAppLink = `${base}?text=${message}`;
  }

  private resetQuoteFormState(): void {
    const defaultValue = {
      nombreCompleto: '',
      whatsappNumero: '',
      tipoEvento: '',
      eventoId: null,
      fechaEvento: null,
      departamento: '',
      mensaje: '',
      dias: null,
      horas: null,
      invitados: '',
      presupuesto: 50,
      extras: {
        drone: false,
        segundoFotografo: false,
        entregaExpress: false,
        album: false,
      },
      comoNosConociste: '',
      consentimiento: false,
    };

    if (this.quoteFormDirective) {
      this.quoteFormDirective.resetForm(defaultValue);
    } else {
      this.quoteForm.reset(defaultValue);
    }

    this.syncHorasControl(this.quoteForm.get('dias')?.value ?? null);
    this.markControlPristine(this.quoteForm);
    this.quoteStarted = false;
  }

  private markControlPristine(control: AbstractControl): void {
    if (control instanceof FormGroup) {
      Object.values(control.controls).forEach((child) =>
        this.markControlPristine(child),
      );
    }
    control.markAsPristine();
    control.markAsUntouched();
    control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  private horasValidator(control: AbstractControl): ValidationErrors | null {
    const rawValue = control.value;
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }
    const normalizedText =
      typeof rawValue === 'number'
        ? rawValue.toString()
        : rawValue.toString().trim();

    if (!normalizedText) {
      return null;
    }

    const numericText = normalizedText.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(numericText)) {
      return { horasFormato: true };
    }

    const value = Number(numericText);
    if (!Number.isFinite(value)) {
      return { horasFormato: true };
    }

    if (value < 1) {
      return { horasMin: true };
    }

    const scaled = value * 2;
    if (Math.abs(scaled - Math.round(scaled)) > 1e-9) {
      return { horasStep: true };
    }

    return null;
  }

  private syncHorasControl(value: unknown): void {
    const control = this.quoteForm.get('horas');
    if (!control) {
      return;
    }
    const parsed = Number(value);
    const valido = Number.isFinite(parsed) && parsed >= 1;
    if (valido && control.disabled) {
      control.enable({ emitEvent: false });
    }
    if (!valido && control.enabled) {
      control.reset('', { emitEvent: false });
      control.disable({ emitEvent: false });
    }
  }

  private fechaEventoEnRangoValidator(): (
    control: AbstractControl,
  ) => ValidationErrors | null {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      const parsed = parseDateInput(control.value as DateInput);
      if (!parsed) {
        return { fechaFormato: true };
      }
      const minTime = this.minQuoteDate.getTime();
      const maxTime = this.maxQuoteDate.getTime();
      const valueTime = new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
      ).getTime();

      if (valueTime < minTime) {
        return { fechaMin: true };
      }
      if (valueTime > maxTime) {
        return { fechaMax: true };
      }
      return null;
    };
  }

  formatBudget(value?: number | null): string {
    const safeValue = typeof value === 'number' ? value : 50;
    const ranges = [
      { max: 25, label: 'Hasta US$ 1,500' },
      { max: 50, label: 'US$ 1,500 - US$ 3,000' },
      { max: 75, label: 'US$ 3,000 - US$ 5,000' },
      { max: 100, label: 'Más de US$ 5,000' },
    ];
    return ranges.find((range) => safeValue <= range.max)?.label ?? 'A definir';
  }

  private createSchemaScript(schema: object): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      `<script type="application/ld+json">${JSON.stringify(schema)}</script>`,
    );
  }

  // Normalizes Date inputs coming from the Angular Material picker
  private formatDate(value: DateInput): string | null {
    return formatIsoDate(value);
  }

  private formatDateDisplay(value: DateInput): string | null {
    const formatted = formatDisplayDate(value, '');
    return formatted || null;
  }

  private startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private addDays(base: Date, days: number): Date {
    const result = new Date(base);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(base: Date, months: number): Date {
    const result = new Date(base);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  // Shapes the final DTO that the landing service expects
  private buildCotizacionPayload(
    value: Record<string, unknown>,
  ): LandingPublicCotizacionPayload {
    const nombre = String(value.nombreCompleto ?? '').trim();
    const celular = this.composePhoneNumber(value.whatsappNumero);
    const fechaEvento =
      this.formatDate(value.fechaEvento as DateInput) ??
      new Date().toISOString().slice(0, 10);

    const diasTexto = String(value.dias ?? '').trim();
    const diasNumber = diasTexto ? Number(diasTexto) : null;
    const diasEvento = Number.isFinite(diasNumber) ? diasNumber : null;

    const horasTexto = String(value.horas ?? '').trim();
    const horasNormalizadas = horasTexto
      .replace(/[^0-9.,]/g, '')
      .replace(/,/g, '.');
    const horasNumber = horasNormalizadas ? Number(horasNormalizadas) : null;
    const horasEstimadas = Number.isFinite(horasNumber) ? horasNumber : null;

    const selectedName = String(value.tipoEvento ?? '').trim();
    const rawEventoId = value.eventoId;
    const parsedEventoId =
      rawEventoId !== undefined && rawEventoId !== null && rawEventoId !== ''
        ? Number(rawEventoId)
        : null;
    const eventoIdFromControl = Number.isFinite(parsedEventoId)
      ? Number(parsedEventoId)
      : null;
    const matchById =
      eventoIdFromControl != null
        ? this.eventOptions.find(
            (option) => option.id != null && option.id === eventoIdFromControl,
          )
        : null;
    const normalizedSelectedName = this.normalizeEventLabel(selectedName);
    const matchByName = this.eventOptions.find(
      (option) =>
        this.normalizeEventLabel(option.name) === normalizedSelectedName,
    );
    const eventoId = matchById?.id ?? matchByName?.id ?? null;
    const tipoEvento =
      selectedName || matchById?.name || matchByName?.name || 'Evento';

    const lugar = String(value.departamento ?? '').trim();

    const origen = String(value.comoNosConociste ?? '').trim() || 'Web';

    const payload: LandingPublicCotizacionPayload = {
      lead: {
        nombre,
        celular,
        origen,
      },
      cotizacion: {
        idTipoEvento: eventoId ?? null,
        tipoEvento,
        fechaEvento,
        lugar,
        diasEvento,
        horasEstimadas,
        mensaje: String(value.mensaje ?? '').trim() || undefined,
      },
    };

    return payload;
  }

  // Normalizes the WhatsApp number keeping only digits provided by the user
  private composePhoneNumber(numberValue: unknown): string {
    return this.onlyDigits(numberValue);
  }

  private onlyDigits(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return value
      .toString()
      .replace(/[^0-9]/g, '')
      .trim();
  }

  private normalizeEventOptions(
    data: (LandingEventDto | LandingEventOption)[],
  ): LandingEventOption[] {
    if (!Array.isArray(data)) {
      return [];
    }
    const mapped = data
      .map((item) => {
        const record = item as unknown as Record<string, unknown>;
        const id = Number(
          record.PK_E_Cod ?? record.id ?? record.ID ?? record.pk,
        );
        const rawName = record.E_Nombre ?? record.nombre ?? record.name ?? null;
        if (!rawName) {
          return null;
        }
        const name = String(rawName).trim();
        if (!name) {
          return null;
        }
        if (!Number.isFinite(id) || id <= 0) {
          return null;
        }
        return {
          id,
          name,
        } as LandingEventOption;
      })
      .filter((item): item is LandingEventOption => Boolean(item));

    const unique = new Map<string, LandingEventOption>();
    for (const entry of mapped) {
      const key = entry.name.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, entry);
      }
    }
    return Array.from(unique.values())
      .filter((option) => {
        const normalized = this.normalizeEventLabel(option.name);
        return normalized !== '' && normalized !== 'otro';
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  private pickEventValue(source: string): string {
    const normalizedSource = this.normalizeEventLabel(source);
    const match = this.eventOptions.find(
      (option) => this.normalizeEventLabel(option.name) === normalizedSource,
    );
    if (match) {
      return match.name;
    }
    return '';
  }

  private syncSelectedEventByName(name: string): void {
    if (!this.quoteForm) {
      return;
    }
    const normalizedName = this.normalizeEventLabel(name);
    const match = this.eventOptions.find(
      (option) => this.normalizeEventLabel(option.name) === normalizedName,
    );
    const eventoId = match ? match.id : null;
    this.quoteForm.patchValue({ eventoId }, { emitEvent: false });
  }

  private normalizeEventLabel(value: string): string {
    return (
      (value ?? '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/[^a-z0-9]/g, '')
        .replace(/s$/, '') ?? ''
    );
  }
}
