import { Component, inject } from '@angular/core';
import { UntypedFormGroup, Validators, UntypedFormBuilder } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-recuperar-contrasena',
  templateUrl: './recuperar-contrasena.component.html',
  styleUrls: ['./recuperar-contrasena.component.css']
})
export class RecuperarContrasenaComponent {

  favoriteSeason: string;
  seasons: string[] = ['Winter', 'Spring', 'Summer', 'Autumn'];
  private readonly fb = inject(UntypedFormBuilder);
  private readonly router = inject(Router);

  miFormulario: UntypedFormGroup = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
  });
  validacion(){
    const {correo} = this.miFormulario.value;
    localStorage.setItem('correo',correo);
    this.router.navigateByUrl('/auth/registro');
    
  }

}
