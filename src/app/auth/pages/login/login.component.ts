import { Component } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { AuthService } from '../../services/auth.service';
import { AuthResponse } from '../../interfaces/auth.interface';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  hide = true;
  miFormulario: UntypedFormGroup = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required, Validators.minLength(6)]],
  });
  constructor(private fb: UntypedFormBuilder, private router: Router, private authService: AuthService) { }
  login() {
    if (this.miFormulario.invalid) {
      this.miFormulario.markAllAsTouched();
      return;
    }
    const { correo, contrasena } = this.miFormulario.value;
    this.authService.login(correo, contrasena)
      .subscribe({
        next: (_resp: AuthResponse) => {
          if (this.authService.esEmpleado()) {
            void this.router.navigateByUrl('/home');
            return;
          }
          if (this.authService.esCliente()) {
            void this.router.navigateByUrl('/cotizaciones');
            return;
          }
          void Swal.fire({
            icon: 'info',
            title: 'Perfil no asignado',
            text: 'Tu usuario no tiene un perfil activo. Contacta al administrador.'
          });
        },
        error: (error: HttpErrorResponse) => {
          const message = error?.error?.message ?? 'No se pudo iniciar sesión. Inténtalo nuevamente.';
          void Swal.fire({
            icon: 'error',
            title: 'Inicio de sesión',
            text: message
          });
        }
      });
  }


}
