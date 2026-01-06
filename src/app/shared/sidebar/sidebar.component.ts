import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {

  constructor(private readonly authService: AuthService) { }

  ngOnInit(): void {
  }

  get puedeVerVentas(): boolean {
    return this.authService.isAdminOrVendedor();
  }

  get puedeVerAdmin(): boolean {
    return this.authService.isAdmin();
  }

}
