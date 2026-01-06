import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    void state;
    const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];

    if (allowedRoles.length === 0) {
      return true;
    }

    if (this.authService.isAdmin()) {
      return true;
    }

    if (this.authService.hasAnyRole(allowedRoles)) {
      return true;
    }

    this.router.navigate(['/home/dashboard']);
    return false;
  }
}
