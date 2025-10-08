import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import { catchError, take, takeUntil } from 'rxjs/operators';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, DateAdapter, MatDateFormats, NativeDateAdapter } from '@angular/material/core';
import { formatDisplayDate, formatIsoDate } from '../shared/utils/date-utils';

import { LandingCotizacionService, LandingCreateCotizacionDto, LandingCountryCodeDto, LandingEventDto } from './services/landing-cotizacion.service';
// Landing copy decks for cards and sections
interface LandingServiceCard {
  id: string;
  title: string;
  description: string;
  bullets: string[];
}

interface PortfolioItem {
  id: string;
  type: 'Bodas' | 'Eventos' | 'Corporativo' | 'Quinceañera' | 'Religioso';
  title: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  source: string;
  poster?: string;
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

// Formats calendar input as dd-MM-yyyy for the form
class LandingDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: any): string {
    if (displayFormat === 'input') {
      return formatDisplayDate(date, '');
    }
    return super.format(date, displayFormat);
  }
}

const LANDING_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'dd-MM-yyyy'
  },
  display: {
    dateInput: 'input',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'dd-MM-yyyy',
    monthYearA11yLabel: 'MMMM yyyy'
  }
};

interface CountryDialCode {
  code: string;
  label: string;
  dialCode: string;
}

interface LandingEventOption {
  id: number;
  name: string;
}

// Short list ensures the selector works if the public API is unreachable
const FALLBACK_COUNTRY_CODES: CountryDialCode[] = [
  { code: 'PE', label: 'Perú', dialCode: '+51' },
  { code: 'MX', label: 'México', dialCode: '+52' },
  { code: 'CO', label: 'Colombia', dialCode: '+57' },
  { code: 'AR', label: 'Argentina', dialCode: '+54' },
  { code: 'CL', label: 'Chile', dialCode: '+56' },
  { code: 'EC', label: 'Ecuador', dialCode: '+593' },
  { code: 'US', label: 'Estados Unidos', dialCode: '+1' },
  { code: 'ES', label: 'España', dialCode: '+34' }
];

const FALLBACK_EVENT_OPTIONS: LandingEventOption[] = [
  { id: 1, name: 'Boda' },
  { id: 2, name: 'Corporativo' },
  { id: 3, name: 'Cumpleaños' }
];

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-PE' },
    { provide: DateAdapter, useClass: LandingDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: LANDING_DATE_FORMATS }
  ]
})
export class LandingComponent implements OnInit, OnDestroy {

  readonly currentYear = new Date().getFullYear();

  // Micro-copy rendered on the hero badges
  readonly heroBadges = [
    { label: '★ 4.9/5', caption: 'Reseñas verificadas' },
    { label: '+320', caption: 'Proyectos realizados' },
    { label: '12 años', caption: 'Capturando historias' }
  ];

  // Service catalog displayed in the first section
  readonly services: LandingServiceCard[] = [
    {
      id: 'bodas',
      title: 'Bodas',
      description: 'Cobertura integral para ceremonia, recepción y fiesta.',
      bullets: [
        'Sesión pre-boda incluida',
        'Video highlight de 3 minutos',
        'Entrega en galería privada'
      ]
    },
    {
      id: 'eventos',
      title: 'Eventos Sociales',
      description: 'Fiestas, aniversarios y celebraciones especiales en Lima y provincias.',
      bullets: [
        'Cobertura flexible desde 2 horas',
        'Video resumen para redes sociales',
        'Equipo compacto y discreto'
      ]
    },
    {
      id: 'corporativo',
      title: 'Corporativo',
      description: 'Eventos empresariales, lanzamientos y branding audiovisual.',
      bullets: [
        'Cobertura multi-cámara',
        'Testimoniales y backstage',
        'Entrega express 48h'
      ]
    },
    {
      id: 'comunion',
      title: 'Comuniones',
      description: 'Reportaje íntimo de ceremonias de primera comunión y celebraciones familiares.',
      bullets: [
        'Cobertura en iglesia y recepción',
        'Retratos familiares dirigidos',
        'Galería lista en 5 días'
      ]
    },
    {
      id: 'barmitzva',
      title: 'Bar/Bat Mitzvá',
      description: 'Cobertura respetuosa y creativa de ceremonias judías y celebraciones temáticas.',
      bullets: [
        'Captura de rituales y tradiciones',
        'Equipo bilingüe disponible',
        'Edición con versiones para redes'
      ]
    },
    {
      id: 'quinceanera',
      title: 'Quinceañera',
      description: 'Cobertura artística para sesiones previas y fiesta central.',
      bullets: [
        'Sesión temática personalizada',
        'Libro premium en 15 días',
        'Drone y segundo fotógrafo opcional'
      ]
    }
  ];

  readonly portfolioFilters: Array<'Todos' | PortfolioItem['type']> = ['Todos', 'Bodas', 'Eventos', 'Corporativo', 'Quinceañera', 'Religioso'];

  // Static showcase for the portfolio grid
  readonly portfolio: PortfolioItem[] = [
    {
      id: 'pf-boda-01',
      type: 'Bodas',
      title: 'Lucía & Rafael – Hacienda Los Ficus',
      thumbnail: 'https://images.unsplash.com/photo-1520854221050-0f4caff449fb?auto=format&fit=crop&w=800&q=80',
      mediaType: 'image',
      source: 'https://images.unsplash.com/photo-1520854221050-0f4caff449fb?auto=format&fit=crop&w=1600&q=80'
    },
    {
      id: 'pf-boda-02',
      type: 'Bodas',
      title: 'Karen & Diego – Sunset en Paracas',
      thumbnail: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
      mediaType: 'image',
      source: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80'
    },
    {
      id: 'pf-evento-01',
      type: 'Eventos',
      title: 'Aniversario 50 años – Grupo Salcantay',
      thumbnail: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
      mediaType: 'image',
      source: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1600&q=80'
    },
    {
      id: 'pf-corporativo-01',
      type: 'Corporativo',
      title: 'Congreso de Innovación 2024',
      thumbnail: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
      mediaType: 'image',
      source: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80'
    },
    {
      id: 'pf-religioso-01',
      type: 'Religioso',
      title: 'Primera comunión – Catedral de Lima',
      thumbnail: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80',
      mediaType: 'image',
      source: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1600&q=80'
    },
    {
      id: 'pf-religioso-02',
      type: 'Religioso',
      title: 'Bar Mitzvah – Comunidad Judía de Lima',
      thumbnail: 'https://images.unsplash.com/photo-1528222354212-a29573cdb844?auto=format&fit=crop&w=800&q=80',
      mediaType: 'image',
      source: 'https://images.unsplash.com/photo-1528222354212-a29573cdb844?auto=format&fit=crop&w=1600&q=80'
    },
    {
      id: 'pf-quince-01',
      type: 'Quinceañera',
      title: 'Valentina – Sesión editorial',
      thumbnail: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80',
      mediaType: 'image',
      source: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1600&q=80'
    },
    {
      id: 'pf-video-01',
      type: 'Eventos',
      title: 'Aftermovie – Festival Creativo',
      thumbnail: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80',
      mediaType: 'video',
      source: 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4',
      poster: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1600&q=80'
    },
    {
      id: 'pf-video-02',
      type: 'Corporativo',
      title: 'Spot – Lanzamiento Tech 2025',
      thumbnail: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=80',
      mediaType: 'video',
      source: 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4',
      poster: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1600&q=80'
    }
  ];

  // Pricing tiers surfaced in “Paquetes”
  readonly packages: PackageTier[] = [
    {
      id: 'esencial',
      name: 'Esencial',
      priceFrom: 'Desde S/ 890',
      hours: 'Cobertura 3 horas',
      photos: '120 fotos editadas',
      video: 'Video highlight 60s',
      delivery: 'Galería privada 5 días',
      addons: ['Drone', '2º fotógrafo', 'Impresiones fine art'],
      recommendedFor: 'Eventos íntimos y celebraciones familiares'
    },
    {
      id: 'signature',
      name: 'Signature',
      priceFrom: 'Desde S/ 1,650',
      hours: 'Cobertura 6 horas',
      photos: '220 fotos editadas',
      video: 'Video highlight 3 min',
      delivery: 'USB + galería privada 7 días',
      addons: ['Drone', 'Live streaming', 'Reels verticales'],
      highlight: true,
      recommendedFor: 'Bodas civiles, quinceañeras y eventos corporativos'
    },
    {
      id: 'premium',
      name: 'Premium',
      priceFrom: 'Desde S/ 2,400',
      hours: 'Cobertura full day',
      photos: '350 fotos editadas',
      video: 'Documental 8 min + highlight',
      delivery: 'Álbum artesanal + backup 1 año',
      addons: ['Drone', 'Equipo documental extra', 'Entrega express 72h'],
      recommendedFor: 'Bodas destino y producciones de alto impacto'
    }
  ];

  // FAQ entries for the accordion
  readonly faqs: FaqItem[] = [
    {
      question: '¿Cómo funcionan las entregas y revisiones?',
      answer: 'Entregamos una galería preliminar en 5-7 días hábiles y ofrecemos hasta 2 rondas de ajustes sin costo.'
    },
    {
      question: '¿Requieren adelanto para reservar la fecha?',
      answer: 'Sí, se reserva con el 30% del paquete contratado. El saldo se cancela el día del evento.'
    },
    {
      question: '¿Cubren eventos fuera de Lima?',
      answer: 'Sí, viajamos a todo el Perú. Se cotizan viáticos y logística según destino.'
    },
    {
      question: '¿Puedo agregar un segundo fotógrafo o drone?',
      answer: 'Claro, contamos con operadores certificados para drone y un pool de fotógrafos adicionales.'
    },
    {
      question: '¿Entregan factura o boleta?',
      answer: 'Emitimos comprobantes electrónicos (boleta o factura) y contratos firmados digitalmente.'
    },
    {
      question: '¿Puedo solicitar archivos RAW o uso comercial?',
      answer: 'Sí. Los RAW se entregan bajo acuerdo y aplican tarifas adicionales según licencia de uso.'
    },
    {
      question: '¿Qué pasa si cambia la fecha?',
      answer: 'Podemos reprogramar sin penalidad hasta 45 días antes. Luego, aplican cargos por bloqueo de agenda.'
    }
  ];

  // Optional extras rendered as checkboxes
  readonly extrasCatalog = [
    { control: 'drone', label: 'Drone 4K', description: 'Piloto certificado DGAC' },
    { control: 'segundoFotografo', label: 'Segundo fotógrafo', description: 'Cobertura multiángulo' },
    { control: 'entregaExpress', label: 'Entrega exprés', description: 'Galería en 72 horas' },
    { control: 'album', label: 'Álbum físico', description: 'Libro fotográfico de 30 páginas' }
  ];

  readonly sourceOptions = ['Recomendación', 'Instagram', 'TikTok', 'Google', 'Evento en vivo', 'Otro'];

  countryCodes: CountryDialCode[] = [];
  private readonly defaultDialCode = FALLBACK_COUNTRY_CODES[0].dialCode;
  eventOptions: LandingEventOption[] = FALLBACK_EVENT_OPTIONS;

  readonly quoteForm: FormGroup;

  submissionSuccess = false;
  isSubmitting = false;
  quoteStarted = false;
  whatsAppLink: string | null = null;
  selectedLightboxItem: PortfolioItem | null = null;
  activePortfolioFilter: PortfolioItem['type'] | 'Todos' = 'Todos';
  selectedPackageId: string | null = null;
  readonly minQuoteDate: Date;

  readonly localBusinessSchema: SafeHtml;
  readonly faqSchema: SafeHtml;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly snackBar: MatSnackBar,
    private readonly sanitizer: DomSanitizer,
    private readonly cotizacionService: LandingCotizacionService
  ) {
    this.minQuoteDate = this.startOfToday();
    this.countryCodes = FALLBACK_COUNTRY_CODES;
    // Primary quote form definition
    this.quoteForm = this.fb.group({
      nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
      whatsappCodigo: [this.defaultDialCode, Validators.required],
      whatsappNumero: ['', [Validators.required, Validators.pattern(/^\d{6,15}$/)]],
      tipoServicio: ['', Validators.required],
      fechaEvento: [null, Validators.required],
      distrito: ['', Validators.required],
      mensaje: [''],
      horas: ['', [Validators.required, Validators.pattern(/^\d+([.,]\d{1,2})?$/)]],
      invitados: [''],
      presupuesto: [50],
      extras: this.fb.group({
        drone: [false],
        segundoFotografo: [false],
        entregaExpress: [false],
        album: [false]
      }),
      comoNosConociste: [''],
      consentimiento: [false, Validators.requiredTrue]
    });

    this.localBusinessSchema = this.createSchemaScript({
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
        addressCountry: 'PE'
      },
      openingHours: 'Mo-Su 09:00-21:00',
      priceRange: '$$',
      sameAs: [
        'https://www.facebook.com/dlacruz',
        'https://www.instagram.com/dlacruz',
        'https://www.tiktok.com/@dlacruz'
      ]
    });

    this.faqSchema = this.createSchemaScript({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    });
  }

  // Fetches country dial codes from the public REST Countries API
  ngOnInit(): void {
    this.loadCountryCodes();
    this.loadEventOptions();
  }

  get filteredPortfolio(): PortfolioItem[] {
    if (this.activePortfolioFilter === 'Todos') {
      return this.portfolio;
    }
    return this.portfolio.filter(item => item.type === this.activePortfolioFilter);
  }

  // Marks the quote as started once any field is focused
  handleQuoteStart(): void {
    if (!this.quoteStarted) {
      this.quoteStarted = true;
      this.trackEvent('quote_start');
    }
  }

  setPortfolioFilter(filter: PortfolioItem['type'] | 'Todos'): void {
    this.activePortfolioFilter = filter;
    this.trackEvent('portfolio_view', { filter });
  }

  // Opens the lightbox modal for portfolio items
  openLightbox(item: PortfolioItem): void {
    this.selectedLightboxItem = item;
    this.trackEvent('portfolio_view', { id: item.id });
  }

  closeLightbox(): void {
    this.selectedLightboxItem = null;
  }

  scrollToSection(anchor: string): void {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Prefills the form when a service card CTA is clicked
  prefillService(service: LandingServiceCard): void {
    const matchedValue = this.pickEventValue(service.title);
    this.quoteForm.patchValue({ tipoServicio: matchedValue });
    this.selectedPackageId = null;
    this.trackEvent('cta_click', { source: 'service-card', service: service.id });
    this.scrollToSection('cotizacion');
  }

  // Prefills the form when a package button is used
  prefillPackage(tier: PackageTier): void {
    this.selectedPackageId = tier.id;
    const matchedValue = this.pickEventValue(`Paquete ${tier.name}`);
    this.quoteForm.patchValue({ tipoServicio: matchedValue });
    this.trackEvent('package_select', { package: tier.id });
    this.scrollToSection('cotizacion');
  }

  // Validates and sends the quote request to the API
  submitQuote(): void {
    this.handleQuoteStart();
    this.whatsAppLink = null;
    console.log('[landing] submitQuote', this.quoteForm.value);
    
    if (this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      this.snackBar.open('Por favor completa los campos obligatorios.', 'Cerrar', { duration: 4000 });
      return;
    }

    this.isSubmitting = true;
    this.submissionSuccess = false;
    const formValue = this.quoteForm.getRawValue();
    const payload = this.buildCotizacionPayload(formValue);

    this.cotizacionService.create(payload)
      .pipe(
        take(1),
        catchError(err => {
          console.error('[landing] submitQuote', err);
          this.snackBar.open('No pudimos registrar tu solicitud. Intenta nuevamente.', 'Cerrar', { duration: 5000 });
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(res => {
        this.isSubmitting = false;
        if (!res) {
          return;
        }
        console.log('[LandingComponent] cotización registrada correctamente', res);
        this.submissionSuccess = true;
        this.trackEvent('quote_submit', { package: this.selectedPackageId });
        this.createWhatsAppLink();
        this.snackBar.open('¡Gracias! Te contactaremos pronto por WhatsApp.', 'Cerrar', { duration: 5000 });
        this.quoteForm.reset({
          whatsappCodigo: this.countryCodes[0]?.dialCode ?? this.defaultDialCode,
          whatsappNumero: '',
          horas: null,
          presupuesto: 50,
          consentimiento: false
        });
        this.selectedPackageId = null;
      });
  }

  clickWhatsApp(source: string): void {
    this.trackEvent('whatsapp_click', { source });
  }

  // Tracks GTM events if dataLayer is present
  trackEvent(eventName: string, params?: Record<string, any>): void {
    const win = window as any;
    if (win && Array.isArray(win.dataLayer)) {
      win.dataLayer.push({ event: eventName, ...params });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  // Retrieves dial codes and keeps a fallback when the HTTP call fails
  private loadCountryCodes(): void {
    this.cotizacionService.getCountryCodes()
      .pipe(
        take(1),
        catchError(err => {
          console.error('[LandingComponent] No se pudieron cargar códigos desde API', err);
          return of(FALLBACK_COUNTRY_CODES);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(codes => {
        const normalized = this.normalizeCountryCodes(codes);
        this.countryCodes = normalized.length ? normalized : FALLBACK_COUNTRY_CODES;
        const currentCode = this.quoteForm.get('whatsappCodigo')?.value;
        const isCurrentValid = this.countryCodes.some(option => option.dialCode === currentCode);
        if (!isCurrentValid) {
          this.quoteForm.patchValue({ whatsappCodigo: this.countryCodes[0]?.dialCode ?? this.defaultDialCode }, { emitEvent: false });
        }
      });
  }

  // Retrieves event names for the select input
  private loadEventOptions(): void {
    this.cotizacionService.getEventos()
      .pipe(
        take(1),
        catchError(err => {
          console.error('[LandingComponent] No se pudieron cargar eventos', err);
          return of(FALLBACK_EVENT_OPTIONS);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(events => {
        const normalized = this.normalizeEventOptions(events);
        this.eventOptions = normalized.length ? normalized : FALLBACK_EVENT_OPTIONS;
      });
  }
  // Builds the WhatsApp deeplink with the sanitized destination number
  private createWhatsAppLink(): void {
    const value = this.quoteForm.getRawValue();
    const service = value.tipoServicio || 'servicio de foto y video';
    const date = this.formatDateDisplay(value.fechaEvento) || 'fecha por definir';
    const district = value.distrito || 'Lima';
    const composedPhone = this.composePhoneNumber(value.whatsappCodigo, value.whatsappNumero);
    const phoneDigits = composedPhone.replace(/\D+/g, '');
    const baseNumber = phoneDigits || '51999999999';
    const base = `https://wa.me/${baseNumber}`;
    const message = encodeURIComponent(`Hola quiero una cotización para ${service} el ${date} en ${district}`);
    this.whatsAppLink = `${base}?text=${message}`;
  }

  formatBudget(value?: number | null): string {
    const safeValue = typeof value === 'number' ? value : 50;
    const ranges = [
      { max: 25, label: 'Hasta S/ 1,500' },
      { max: 50, label: 'S/ 1,500 - S/ 3,000' },
      { max: 75, label: 'S/ 3,000 - S/ 5,000' },
      { max: 100, label: 'Más de S/ 5,000' }
    ];
    return ranges.find(range => safeValue <= range.max)?.label ?? 'A definir';
  }

  private createSchemaScript(schema: object): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
    );
  }

  // Normalizes Date inputs coming from the Angular Material picker
  private formatDate(value: unknown): string | null {
    return formatIsoDate(value as any);
  }

  private formatDateDisplay(value: unknown): string | null {
    const formatted = formatDisplayDate(value as any, '');
    return formatted || null;
  }

  private startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Shapes the final DTO that the landing service expects
  private buildCotizacionPayload(value: any): LandingCreateCotizacionDto {
    const nombre = (value.nombreCompleto ?? '').toString().trim();
    const celular = this.composePhoneNumber(value.whatsappCodigo, value.whatsappNumero);
    const fechaEvento = this.formatDate(value.fechaEvento) ?? new Date().toISOString().slice(0, 10);

    const horasTexto = (value.horas ?? '').toString().trim();
    const horasNormalizadas = horasTexto.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
    const horasNumber = horasNormalizadas ? Number(horasNormalizadas) : null;
    const horasEstimadas = Number.isFinite(horasNumber) ? horasNumber : null;

    const payload: LandingCreateCotizacionDto = {
      lead: {
        nombre,
        celular,
        origen: value.comoNosConociste || 'Web'
      },
      cotizacion: {
        tipoServicio: value.tipoServicio,
        fechaEvento,
        lugar: value.distrito,
        horasEstimadas,
        mensaje: (value.mensaje ?? '').toString().trim(),
        estado: 'Borrador'
      }
    };

    console.log('[LandingComponent] payload cotizacion listo', payload);
    return payload;
  }

  // Joins selected country code with the numeric WhatsApp input
  private composePhoneNumber(codeValue: unknown, numberValue: unknown): string {
    const codeDigits = this.onlyDigits(codeValue);
    const numberDigits = this.onlyDigits(numberValue);
    if (!numberDigits) {
      return '';
    }
    const prefix = codeDigits ? `+${codeDigits}` : this.defaultDialCode;
    return `${prefix}${numberDigits}`;
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

  private normalizeEventOptions(data: Array<LandingEventDto | LandingEventOption>): LandingEventOption[] {
    if (!Array.isArray(data)) {
      return [];
    }
    const mapped = data
      .map(item => {
        const id = Number((item as any).PK_E_Cod ?? (item as any).id ?? (item as any).ID ?? (item as any).pk);
        const name = (item as any).E_Nombre ?? (item as any).name ?? null;
        if (!name) {
          return null;
        }
        return {
          id: Number.isFinite(id) ? id : Math.random(),
          name: name.toString()
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
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  private pickEventValue(source: string): string {
    const normalizedSource = this.normalizeEventLabel(source);
    const match = this.eventOptions.find(option => this.normalizeEventLabel(option.name) === normalizedSource);
    if (match) {
      return match.name;
    }
    if (!normalizedSource) {
      return '';
    }
    return 'Otro';
  }

  private normalizeEventLabel(value: string): string {
    return (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[^a-z0-9]/g, '')
      .replace(/s$/, '')
      ?? '';
  }

  // Maps varying REST Countries structures into a consistent shape for the selector
  private normalizeCountryCodes(data: Array<LandingCountryCodeDto | CountryDialCode>): CountryDialCode[] {
    if (!Array.isArray(data)) {
      return [];
    }
    const mapped = data
      .map(item => {
        const directDial = (item as any).dialCode ?? (item as any).dial_code;
        let dial = this.ensurePlusPrefix(directDial);

        if (!dial) {
          const idd = (item as any).idd;
          if (idd && (idd.root || (Array.isArray(idd.suffixes) && idd.suffixes.length))) {
            const root = idd.root ?? '';
            const suffix = Array.isArray(idd.suffixes) && idd.suffixes.length ? idd.suffixes[0] ?? '' : '';
            dial = this.ensurePlusPrefix(`${root}${suffix}`);
          }
        }

        const code = (item as any).code ?? (item as any).cca2 ?? (item as any).iso2 ?? (item as any).isoCode ?? '';
        const label =
          (item as any).label ??
          (item as any).name?.common ??
          (item as any).name?.official ??
          (item as any).name ??
          (item as any).nombre ??
          code;
        return !dial
          ? null
          : {
              code: code || label,
              label: label || code || dial,
              dialCode: dial
            } as CountryDialCode;
      })
      .filter((item): item is CountryDialCode => Boolean(item));

    const unique = new Map<string, CountryDialCode>();
    for (const entry of mapped) {
      if (!unique.has(entry.dialCode)) {
        unique.set(entry.dialCode, entry);
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  // Ensures every dial code carries a plus sign and strips stray characters
  private ensurePlusPrefix(value: unknown): string {
    const digits = this.onlyDigits(value);
    if (!digits) {
      return '';
    }
    return `+${digits}`;
  }
}
