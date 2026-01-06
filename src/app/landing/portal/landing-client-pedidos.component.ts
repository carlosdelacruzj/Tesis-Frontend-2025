import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from 'src/app/auth/services/auth.service';
import { ClientePedido, LandingClientPortalService } from '../services';

@Component({
  selector: 'app-landing-client-pedidos',
  templateUrl: './landing-client-pedidos.component.html',
  styleUrls: ['./landing-client-pedidos.component.css']
})
export class LandingClientPedidosComponent implements OnInit, OnDestroy {
  loading = false;
  error: string | null = null;
  pedidos: ClientePedido[] = [];
  clienteNombre: string | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly clientPortalService = inject(LandingClientPortalService);

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
    this.loadPedidos(usuario.clienteId);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPedidos(clienteId: number): void {
    this.loading = true;
    this.error = null;
    this.clientPortalService.getPedidos(clienteId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: pedidos => {
          this.loading = false;
          this.pedidos = pedidos ?? [];
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.pedidos = [];
          this.error = err.error?.message ?? err.message ?? 'No pudimos cargar tus pedidos.';
        }
      });
  }
}
