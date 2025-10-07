import { Component, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, of } from 'rxjs';
import { catchError, take, takeUntil } from 'rxjs/operators';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, DateAdapter, MatDateFormats, NativeDateAdapter } from '@angular/material/core';

import { LandingCotizacionService, LandingCreateCotizacionDto } from './services/landing-cotizacion.service';
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

class LandingDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: any): string {
    if (displayFormat === 'input') {
      const day = this._to2Digit(date.getDate());
      const month = this._to2Digit(date.getMonth() + 1);
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return super.format(date, displayFormat);
  }

  private _to2Digit(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }
}

const LANDING_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'dd/MM/yyyy'
  },
  display: {
    dateInput: 'input',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'dd/MM/yyyy',
    monthYearA11yLabel: 'MMMM yyyy'
  }
};

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
export class LandingComponent implements OnDestroy {

  readonly currentYear = new Date().getFullYear();

  readonly heroBadges = [
    { label: '★ 4.9/5', caption: 'Reseñas verificadas' },
    { label: '+320', caption: 'Proyectos realizados' },
    { label: '12 años', caption: 'Capturando historias' }
  ];

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

  readonly extrasCatalog = [
    { control: 'drone', label: 'Drone 4K', description: 'Piloto certificado DGAC' },
    { control: 'segundoFotografo', label: 'Segundo fotógrafo', description: 'Cobertura multiángulo' },
    { control: 'entregaExpress', label: 'Entrega exprés', description: 'Galería en 72 horas' },
    { control: 'album', label: 'Álbum físico', description: 'Libro fotográfico de 30 páginas' }
  ];

  readonly sourceOptions = ['Recomendación', 'Instagram', 'TikTok', 'Google', 'Evento en vivo', 'Otro'];

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
    this.quoteForm = this.fb.group({
      nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
      whatsapp: ['+51', [Validators.required, Validators.pattern(/^\+51\s?[0-9]{9}$/)]],
      email: ['', [Validators.required, Validators.email]],
      tipoServicio: ['', Validators.required],
      fechaEvento: [null, Validators.required],
      distrito: ['', Validators.required],
      mensaje: [''],
      horas: [''],
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

  get filteredPortfolio(): PortfolioItem[] {
    if (this.activePortfolioFilter === 'Todos') {
      return this.portfolio;
    }
    return this.portfolio.filter(item => item.type === this.activePortfolioFilter);
  }

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

  prefillService(service: LandingServiceCard): void {
    this.quoteForm.patchValue({ tipoServicio: service.title });
    this.selectedPackageId = null;
    this.trackEvent('cta_click', { source: 'service-card', service: service.id });
    this.scrollToSection('cotizacion');
  }

  prefillPackage(tier: PackageTier): void {
    this.selectedPackageId = tier.id;
    this.quoteForm.patchValue({ tipoServicio: `Paquete ${tier.name}` });
    this.trackEvent('package_select', { package: tier.id });
    this.scrollToSection('cotizacion');
  }

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
          whatsapp: '+51',
          presupuesto: 50,
          consentimiento: false
        });
        this.selectedPackageId = null;
      });
  }

  clickWhatsApp(source: string): void {
    this.trackEvent('whatsapp_click', { source });
  }

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
  private createWhatsAppLink(): void {
    const value = this.quoteForm.getRawValue();
    const service = value.tipoServicio || 'servicio de foto y video';
    const date = this.formatDateDisplay(value.fechaEvento) || 'fecha por definir';
    const district = value.distrito || 'Lima';
    const phoneDigits = (value.whatsapp ?? '').toString().replace(/\D+/g, '');
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

  private formatDate(value: unknown): string | null {
    const date = this.toDate(value);
    return date ? date.toISOString().slice(0, 10) : null;
  }

  private formatDateDisplay(value: unknown): string | null {
    const date = this.toDate(value);
    if (!date) {
      return null;
    }
    return new Intl.DateTimeFormat('es-PE').format(date);
  }

  private startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private toDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const date = new Date(value as string);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private buildCotizacionPayload(value: any): LandingCreateCotizacionDto {
    const nombre = (value.nombreCompleto ?? '').toString().trim();
    const celular = (value.whatsapp ?? '').toString().replace(/\D+/g, '');
    const fechaEvento = this.formatDate(value.fechaEvento) ?? new Date().toISOString().slice(0, 10);

    const horasTexto = (value.horas ?? '').toString().trim();
    const horasNormalizadas = horasTexto.replace(/[^0-9.,]/g, '').replace(',', '.');
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
}
