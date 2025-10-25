import { CommonModule } from '@angular/common';
import { AfterContentInit, Component, ContentChild, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormGroupDirective, NgForm } from '@angular/forms';

@Component({
  selector: 'app-formulario-base',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './formulario-base.component.html',
  styleUrls: ['./formulario-base.component.css']
})
export class FormularioBaseComponent implements AfterContentInit, OnChanges {
  /** Muestra estado de carga y oculta el contenido proyectado */
  @Input() loading = false;

  /** Mensaje a mostrar junto al spinner cuando loading es true */
  @Input() loadingMessage = 'Procesando…';

  /** Texto de error simple a mostrar sobre el formulario */
  @Input() error: string | null = null;

  /** Estado del modal contenedor. Cuando cambia de abierto a cerrado reseteará el formulario proyectado. */
  @Input() open = true;

  /** Controla si se resetea automáticamente al cerrar (open: true -> false) */
  @Input() autoResetOnClose = true;

  @ContentChild(NgForm, { descendants: true }) projectedNgForm?: NgForm;
  @ContentChild(FormGroupDirective, { descendants: true }) projectedFormGroup?: FormGroupDirective;

  private hasInitialised = false;

  ngAfterContentInit(): void {
    this.hasInitialised = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.hasInitialised) return;
    if (this.autoResetOnClose && changes['open'] && !changes['open'].firstChange) {
      const wasOpen = changes['open'].previousValue;
      const isOpen = changes['open'].currentValue;
      if (wasOpen && !isOpen) {
        this.resetProjectedForm();
      }
    }
  }

  resetProjectedForm(): void {
    Promise.resolve().then(() => {
      if (this.projectedNgForm) {
        this.projectedNgForm.resetForm();
      } else if (this.projectedFormGroup) {
        this.projectedFormGroup.resetForm();
      }
    });
  }
}
