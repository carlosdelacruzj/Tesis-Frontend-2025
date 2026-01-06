import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): boolean {
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
