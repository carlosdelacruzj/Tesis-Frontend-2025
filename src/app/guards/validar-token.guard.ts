import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ValidarTokenGuard {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  canActivate(): Observable<boolean> | boolean {
    return this.authService.verificaAuteticacion()
      .pipe(
        tap(estaAutenticado => {
          if (!estaAutenticado) {
            if (this.authService.esCliente()) {
              this.router.navigate(['/']);
            } else {
              this.router.navigate(['./auth']);
            }
          }
        })
      );
  }
  canLoad(): Observable<boolean> | boolean {
    return this.authService.verificaAuteticacion()
    .pipe(
      tap(estaAutenticado => {
        if (!estaAutenticado) {
          if (this.authService.esCliente()) {
            this.router.navigate(['/']);
          } else {
            this.router.navigate(['./auth']);
          }
        }
      })
    );
  }
}
