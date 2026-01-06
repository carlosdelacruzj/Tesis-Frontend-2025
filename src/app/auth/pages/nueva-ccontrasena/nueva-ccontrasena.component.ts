import { Component, inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-nueva-ccontrasena',
  templateUrl: './nueva-ccontrasena.component.html',
  styleUrls: ['./nueva-ccontrasena.component.css']
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
