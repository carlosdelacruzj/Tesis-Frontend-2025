import { Component, ElementRef, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/auth/services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  dropdownOpen = false;

  get usuario(){
    return this.authService.usuario;
  }
  
  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly elementRef: ElementRef<HTMLElement>
  ) { }

  ngOnInit(): void {
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
