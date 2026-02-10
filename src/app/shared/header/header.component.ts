import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent {
  dropdownOpen = false;
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  get usuario() {
    return this.authService.usuario;
  }

  get displayName(): string {
    const user = this.usuario;
    if (!user) return 'Usuario';
    const fullName = `${user.nombres ?? ''} ${user.apellidos ?? ''}`.trim();
    return fullName || user.correo || 'Usuario';
  }

  get userInitials(): string {
    const name = this.displayName;
    if (!name || name === 'Usuario') return 'U';
    const parts = name.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts[1]?.[0] ?? '';
    return `${first}${second}`.toUpperCase() || 'U';
  }

  toggleDropdown(): void {
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
