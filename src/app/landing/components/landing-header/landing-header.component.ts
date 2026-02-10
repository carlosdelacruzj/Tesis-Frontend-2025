import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-landing-header',
  templateUrl: './landing-header.component.html',
  styleUrls: ['./landing-header.component.css']
})
export class LandingHeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  dropdownOpen = false;

  get isCliente(): boolean {
    return this.authService.esCliente();
  }

  get isEmpleado(): boolean {
    return this.authService.esEmpleado();
  }

  get isAuthenticated(): boolean {
    return this.authService.usuario != null;
  }

  get displayName(): string {
    const user = this.authService.usuario;
    if (!user) return 'Invitado';
    const fullName = `${user.nombres ?? ''} ${user.apellidos ?? ''}`.trim();
    return fullName || user.correo || 'Usuario';
  }

  get userInitials(): string {
    const name = this.displayName;
    if (!name || name === 'Invitado' || name === 'Usuario') return 'IN';
    const parts = name.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return `${first}${second}`.toUpperCase() || 'IN';
  }

  navigateToSection(event: Event | null, sectionId: string): void {
    event?.preventDefault();
    const currentUrl = this.router.url.split('?')[0]?.split('#')[0]?.replace(/\/+$/, '') ?? '';
    const isHome = currentUrl === '' || currentUrl === '/' || currentUrl === '/inicio';

    if (isHome) {
      if (typeof window !== 'undefined') {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    void this.router.navigate(['/inicio'], { fragment: sectionId });
  }

  handleCotizacion(): void {
    this.navigateToSection(null, 'cotizacion');
  }

  openLogin(): void {
    if (this.isAuthenticated) {
      void this.router.navigate(['/home/dashboard']);
      return;
    }
    void this.router.navigate(['/auth/login']);
  }

  toggleDropdown(): void {
    if (!this.isAuthenticated) {
      this.openLogin();
      return;
    }
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeDropdown(): void {
    this.dropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.dropdownOpen = false;
    }
  }

  logout(): void {
    this.closeDropdown();
    this.router.navigateByUrl('/auth');
    this.authService.logout();
  }
}
