import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  HostListener,
  Inject,
  Renderer2
} from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';
type CloseReason = 'confirm' | 'cancel' | 'close' | 'backdrop' | 'esc';

@Component({
  selector: 'app-modal-base',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-base.component.html',
  styleUrls: ['./modal-base.component.css']
})
export class ModalBaseComponent implements OnChanges, AfterViewInit, OnDestroy {
  /** Controla si el modal está abierto */
  @Input() open = false;

  /** Título accesible/visual del modal (si no proyectas header) */
  @Input() title = '';

  /** Tamaño del modal (Bootstrap-like) */
  @Input() size: ModalSize = 'md';

  /** Deshabilita cualquier intento de cerrar */
  @Input() disableClose = false;

  /** Cerrar al hacer click en el backdrop */
  @Input() closeOnBackdrop = true;

  /** Cerrar al presionar ESC */
  @Input() closeOnEsc = true;

  /** Mostrar botón “X” */
  @Input() showCloseButton = true;

  /** Botón primario/acciones por defecto */
  @Input() primaryLabel = 'Guardar';
  @Input() primaryVariant: 'primary'|'danger'|'success'|'warning'|'dark'|'secondary' = 'primary';
  @Input() showPrimary = true;

  /** Botón secundario por defecto */
  @Input() secondaryLabel = 'Cancelar';
  @Input() showSecondary = true;

  /** Estado cargando (deshabilita botones, muestra spinner en primario) */
  @Input() loading = false;

  /** Autoenfoque al abrir (primer elemento focuseable dentro del modal) */
  @Input() autofocus = true;

  /** A11y refs */
  @Input() ariaDescribedBy?: string;

  /** ¿Mostrar footer por defecto? (si proyectas [modal-footer], pon esto en false) */
  @Input() useDefaultFooter = true;

  /** Eventos */
  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<CloseReason>();
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('dialog', { static: false }) dialogRef!: ElementRef<HTMLElement>;
  @ViewChild('closeBtn', { static: false }) closeBtnRef!: ElementRef<HTMLButtonElement>;

  private previouslyFocused: Element | null = null;
  private static activeScrollLocks = 0;
  private hasScrollLock = false;
  private closingInternally = false;
  private dragPosition = { x: 0, y: 0 };
  private dragOrigin = { x: 0, y: 0 };
  private dragStartPoint: { x: number; y: number } | null = null;
  private dragging = false;

  constructor(
    @Inject(DOCUMENT) private readonly doc: Document | null,
    private readonly renderer: Renderer2
  ) {}

  /** Clase de tamaño */
  get sizeClass(): string {
    switch (this.size) {
      case 'sm': return 'modal-sm';
      case 'lg': return 'modal-lg';
      case 'xl': return 'modal-xl';
      default:   return '';
    }
  }

  ngAfterViewInit(): void {
    this.syncBodyScroll();
    if (this.open) this.onOpened();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && !changes['open'].firstChange) {
      this.syncBodyScroll();
      if (this.open) {
        setTimeout(() => this.onOpened(), 0);
        this.closingInternally = false;
      } else {
        this.resetDragPosition();
        if (!this.closingInternally) {
          this.restoreFocus();
          this.closed.emit('close'); // cierre programático
        }
        this.closingInternally = false;
      }
    }
  }

  ngOnDestroy(): void {
    this.resetDragPosition();
    this.unlockBodyScroll();
  }

  /** Acciones públicas para usar en plantilla o desde el padre */
  close(reason: CloseReason = 'close') {
    if (this.disableClose) return;
    this.closingInternally = true;
    this.open = false;
    this.syncBodyScroll();
    this.resetDragPosition();
    this.restoreFocus();
    this.closed.emit(reason);
  }

  onConfirm(): void {
    if (this.disableClose) return;
    this.confirm.emit();
    this.close('confirm');
  }

  onCancel(): void {
    if (this.disableClose) return;
    this.cancel.emit();
    this.close('cancel');
  }

  onClickBackdrop(e: MouseEvent): void {
    if (this.disableClose || !this.closeOnBackdrop) return;
    if ((e.target as HTMLElement)?.classList?.contains('modal-backdrop')) {
      this.close('backdrop');
    }
  }

  onDragStart(ev: MouseEvent): void {
    if (ev.button !== 0 || !this.dialogRef?.nativeElement) {
      return;
    }
    const target = ev.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select')) {
      return;
    }
    this.dragging = true;
    this.dragStartPoint = { x: ev.clientX, y: ev.clientY };
    this.dragOrigin = { ...this.dragPosition };
    this.renderer.addClass(this.dialogRef.nativeElement, 'is-dragging');
    ev.preventDefault();
  }

  /** ESC para cerrar y TAB para trap de foco */
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent) {
    if (!this.open) return;
    if (ev.key === 'Escape' && this.closeOnEsc && !this.disableClose) {
      ev.stopPropagation();
      ev.preventDefault();
      this.close('esc');
    } else if (ev.key === 'Tab') {
      this.trapFocus(ev);
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(ev: MouseEvent): void {
    if (!this.dragging || !this.dragStartPoint || !this.dialogRef?.nativeElement) {
      return;
    }
    const nextX = this.dragOrigin.x + (ev.clientX - this.dragStartPoint.x);
    const nextY = this.dragOrigin.y + (ev.clientY - this.dragStartPoint.y);
    this.dragPosition = { x: nextX, y: nextY };
    this.applyDialogTransform(nextX, nextY);
  }

  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(ev: MouseEvent): void {
    if (!this.dragging) return;
    if (ev.button !== 0) return;
    this.dragging = false;
    this.dragStartPoint = null;
    this.dragOrigin = { ...this.dragPosition };
    if (this.dialogRef?.nativeElement) {
      this.renderer.removeClass(this.dialogRef.nativeElement, 'is-dragging');
    }
  }

  /** ---------------- private helpers ---------------- */

  private onOpened() {
    this.previouslyFocused = this.doc?.activeElement ?? null;
    if (!this.dialogRef?.nativeElement) return;
    this.resetDragPosition();

    if (this.autofocus) {
      const focusables = this.getFocusableElements(this.dialogRef.nativeElement);
      if (focusables.length) {
        (focusables[0] as HTMLElement).focus();
      } else if (this.showCloseButton && this.closeBtnRef?.nativeElement) {
        this.closeBtnRef.nativeElement.focus();
      } else {
        this.dialogRef.nativeElement.focus();
      }
    }

    this.opened.emit();
  }

  private restoreFocus() {
    const el = this.previouslyFocused as HTMLElement | null;
    if (el && typeof el.focus === 'function') {
      setTimeout(() => el.focus(), 0);
    }
    this.previouslyFocused = null;
  }

  private trapFocus(ev: KeyboardEvent) {
    const container = this.dialogRef?.nativeElement;
    if (!container) return;
    const focusables = this.getFocusableElements(container);
    if (!focusables.length) return;

    const first = focusables[0] as HTMLElement;
    const last  = focusables[focusables.length - 1] as HTMLElement;
    const active = (this.doc?.activeElement ?? null) as HTMLElement | null;

    if (ev.shiftKey && active === first) {
      ev.preventDefault(); last.focus();
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault(); first.focus();
    }
  }

  private applyDialogTransform(x: number, y: number): void {
    if (!this.dialogRef?.nativeElement) return;
    this.dialogRef.nativeElement.style.transform = `translate(${x}px, ${y}px)`;
  }

  private resetDragPosition(): void {
    this.dragging = false;
    this.dragPosition = { x: 0, y: 0 };
    this.dragOrigin = { x: 0, y: 0 };
    this.dragStartPoint = null;
    if (this.dialogRef?.nativeElement) {
      this.renderer.removeClass(this.dialogRef.nativeElement, 'is-dragging');
      this.dialogRef.nativeElement.style.transform = '';
    }
  }

  private getFocusableElements(root: HTMLElement): Element[] {
    return Array.from(
      root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !((el as HTMLElement).hasAttribute('disabled')));
  }

  private syncBodyScroll() {
    if (this.open) this.lockBodyScroll(); else this.unlockBodyScroll();
  }
  private lockBodyScroll() {
    const body = this.doc?.body ?? null;
    if (!body || this.hasScrollLock) return;
    if (ModalBaseComponent.activeScrollLocks === 0) {
      this.renderer.addClass(body, 'modal-open');
    }
    ModalBaseComponent.activeScrollLocks++;
    this.hasScrollLock = true;
  }
  private unlockBodyScroll() {
    const body = this.doc?.body ?? null;
    if (!body || !this.hasScrollLock) return;
    ModalBaseComponent.activeScrollLocks = Math.max(ModalBaseComponent.activeScrollLocks - 1, 0);
    if (ModalBaseComponent.activeScrollLocks === 0) {
      this.renderer.removeClass(body, 'modal-open');
    }
    this.hasScrollLock = false;
  }
}
