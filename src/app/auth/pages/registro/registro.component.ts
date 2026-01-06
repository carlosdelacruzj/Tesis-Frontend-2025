import { Component, inject } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.css']
})
export class RegistroComponent {
  private readonly fb = inject(UntypedFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  codigo = 0;
  miFormulario: UntypedFormGroup = this.fb.group({
    pas1: ['', [Validators.required, Validators.maxLength(1)]],
    pas2: ['', [Validators.required, Validators.minLength(1)]],
    pas3: ['', [Validators.required, Validators.minLength(1)]],
    pas4: ['', [Validators.required, Validators.minLength(1)]],
    pas5: ['', [Validators.required, Validators.minLength(1)]],
    pas6: ['', [Validators.required, Validators.minLength(1)]],

  });
  validacion(){
    console.log(this.miFormulario.value);
    const { pas1, pas2, pas3, pas4, pas5, pas6 } = this.miFormulario.value;
    this.codigo = parseInt(`${pas1}${pas2}${pas3}${pas4}${pas5}${pas6}`);
    this.authService.validacion(localStorage.getItem('correo'),this.codigo).subscribe(
      resp => {
        console.log(localStorage.getItem('correo'));
        console.log(this.codigo);
        
        console.log(resp.validacion)
        if (resp.validacion===0) {
          this.miFormulario.reset();

        }else{
          this.router.navigateByUrl('/auth/nueva-ccontrasena')
        }
      }
    )
    
  }
}
