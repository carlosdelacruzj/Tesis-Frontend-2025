import { Component, inject } from '@angular/core';
import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {

  private readonly authService = inject(AuthService);

  get puedeVerVentas(): boolean {
    return this.authService.isAdminOrVendedor();
  }

  get puedeVerAdmin(): boolean {
    return this.authService.isAdmin();
  }

}
