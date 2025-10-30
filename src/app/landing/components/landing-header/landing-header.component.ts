import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-landing-header',
  templateUrl: './landing-header.component.html',
  styleUrls: ['./landing-header.component.css']
})
export class LandingHeaderComponent {

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  get isCliente(): boolean {
    return this.authService.esCliente();
  }

  get isEmpleado(): boolean {
    return this.authService.esEmpleado();
  }

  get isAuthenticated(): boolean {
    return this.authService.usuario != null;
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
    void this.router.navigate(['/auth/login']);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/inicio']);
  }
}
