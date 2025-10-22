import { Component } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  hide = true;
  miFormulario: UntypedFormGroup = this.fb.group({
    email: ['delacruzcarlos1405@gmail.com', [Validators.required, Validators.email]],
    password: ['12345678', [Validators.required, Validators.minLength(6)]],
    // email: ['developerricardovillanueva18@gmail.com', [Validators.required, Validators.email]],
    // password: ['12345678', [Validators.required, Validators.minLength(6)]],
  });
  constructor(private fb: UntypedFormBuilder, private router: Router, private authService: AuthService) { }
  login() {
    console.log(this.miFormulario.value);
    const { email, password } = this.miFormulario.value;
    this.authService.login(email, password)
      .subscribe(resp => {
        console.log(resp);
        // if (resp === false) {

        //   Swal.fire('Error', 'El Correo o la contraseña son incorrectas', 'error')

        // } else {
          this.router.navigateByUrl('/home')
        // }
      });

  }


}
