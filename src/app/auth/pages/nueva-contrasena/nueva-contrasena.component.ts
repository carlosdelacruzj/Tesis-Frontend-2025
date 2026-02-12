import { Component, inject } from '@angular/core';
import {
  UntypedFormGroup,
  UntypedFormBuilder,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-nueva-contrasena',
  templateUrl: './nueva-contrasena.component.html',
  styleUrls: ['./nueva-contrasena.component.css'],
})
export class NuevaCContrasenaComponent {
  private readonly fb = inject(UntypedFormBuilder);
  miFormulario: UntypedFormGroup = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
  });
  validacion(): void {
    if (this.miFormulario.invalid) {
      this.miFormulario.markAllAsTouched();
    }
  }
}
