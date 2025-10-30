import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from 'src/app/auth/services/auth.service';
import { ClienteCotizacion, LandingClientPortalService } from '../services';

@Component({
  selector: 'app-landing-client-cotizaciones',
  templateUrl: './landing-client-cotizaciones.component.html',
  styleUrls: ['./landing-client-cotizaciones.component.css']
})
export class LandingClientCotizacionesComponent implements OnInit, OnDestroy {
  loading = false;
  error: string | null = null;
  cotizaciones: ClienteCotizacion[] = [];
  clienteNombre: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly clientPortalService: LandingClientPortalService
  ) {}

  ngOnInit(): void {
    const usuario = this.authService.usuario;
    if (!usuario) {
      void this.router.navigate(['/auth/login']);
      return;
    }

    if (usuario.clienteId == null) {
      if (usuario.empleadoId != null) {
        void this.router.navigate(['/home']);
      } else {
        this.authService.logout();
        void this.router.navigate(['/inicio']);
      }
      return;
    }
    this.clienteNombre = [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ').trim() || null;
    this.loadCotizaciones(usuario.clienteId);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCotizaciones(clienteId: number): void {
    this.loading = true;
    this.error = null;
    this.clientPortalService.getCotizaciones(clienteId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: cotizaciones => {
          this.loading = false;
          this.cotizaciones = cotizaciones ?? [];
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.cotizaciones = [];
          this.error = err.error?.message ?? err.message ?? 'No pudimos cargar tus cotizaciones.';
        }
      });
  }
}
