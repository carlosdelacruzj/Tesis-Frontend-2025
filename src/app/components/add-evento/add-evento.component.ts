import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EventoServicioDataService } from 'src/app/control-panel/administrar-paquete-servicio/service/evento-servicio-data.service';

@Component({
  selector: 'app-add-evento',
  templateUrl: './add-evento.component.html',
})
export class AddEventoComponent {
  loading = false;

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
  });

  constructor(
    private fb: FormBuilder,
    private snack: MatSnackBar,
    private svc: EventoServicioDataService,
    private dialogRef: MatDialogRef<AddEventoComponent>
  ) {}

  /** Normaliza el nombre para buscar la imagen por archivo */
  private slugify(v: string): string {
    return (v || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')  // solo letras, números y espacios/guiones
      .replace(/\s+/g, '-')          // espacios -> guiones
      .replace(/-+/g, '-');          // colapsa guiones
  }

  get slug(): string {
    return this.slugify(this.form.get('nombre')?.value || '');
  }

  get hintPath(): string {
    const s = this.slug || '<slug>';
    return `assets/images/${s}.jpg o .png`;
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  save(): void {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    const nombre = (this.form.value.nombre || '').trim();

    this.svc.crearEvento(nombre).subscribe({

      next: () => {
        this.snack.open('Evento creado correctamente', 'OK', { duration: 2500 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.loading = false;

        // Marca error de duplicado si el backend devuelve 409 (o mensaje típico)
        if (err?.status === 409 || /existe/i.test(err?.error?.message || '')) {
          this.form.get('nombre')?.setErrors({ duplicado: true });
          return;
        }

        this.snack.open('No pudimos crear el evento. Intenta nuevamente.', 'Cerrar', {
          duration: 3500,
        });
      },
    });
  }
}
