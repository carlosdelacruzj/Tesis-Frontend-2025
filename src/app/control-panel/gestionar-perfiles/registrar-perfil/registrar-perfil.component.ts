import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { ApiErrorResponse, PerfilCatalogo } from '../model/perfil.model';
import { PerfilService } from '../service/perfil.service';
import { PersonalService } from '../../gestionar-personal/service/personal.service';
import { Empleado } from '../../gestionar-personal/model/personal.model';

interface EmpleadoOption {
  idEmpleado: number;
  idUsuario: number;
  nombreCompleto: string;
  correo: string;
  estado: string;
}

@Component({
  selector: 'app-registrar-perfil',
  templateUrl: './registrar-perfil.component.html',
  styleUrls: ['./registrar-perfil.component.css']
})
export class RegistrarPerfilComponent implements OnInit {

  perfiles: PerfilCatalogo[] = [];
  empleados: EmpleadoOption[] = [];
  empleadosFiltrados: EmpleadoOption[] = [];
  empleadoBusqueda = '';
  usuarioId: number | null = null;
  perfilCodigo = '';
  principal = false;
  loadingPerfiles = false;
  loadingEmpleados = false;
  submitting = false;
  error: string | null = null;

  private readonly service = inject(PerfilService);
  private readonly personalService = inject(PersonalService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.loadPerfiles();
    this.loadEmpleados();
    if (this.service.selectedPerfilCodigo) {
      this.perfilCodigo = this.service.selectedPerfilCodigo;
    }
  }

  asignarPerfil(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    const usuarioId = Number(form.value.usuarioId);
    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      this.error = 'El usuarioId debe ser numerico y mayor que cero.';
      return;
    }

    this.submitting = true;
    this.error = null;

    this.service.asignarPerfilPorCodigo(usuarioId, String(form.value.perfilCodigo), Boolean(form.value.principal))
      .subscribe({
        next: () => {
          this.submitting = false;
          void Swal.fire({
            text: 'Perfil asignado correctamente.',
            icon: 'success',
            confirmButtonText: 'Ok'
          });
          this.router.navigate(['/home/gestionar-perfiles/editar-perfil'], { queryParams: { usuarioId } });
        },
        error: (err) => {
          this.submitting = false;
          this.error = this.getErrorMessage(err) ?? 'No se pudo asignar el perfil.';
          void Swal.fire({
            text: this.error,
            icon: 'warning',
            confirmButtonText: 'Ok'
          });
        }
      });
  }

  onEmpleadoChange(selectedId: number | null): void {
    this.usuarioId = selectedId ? Number(selectedId) : null;
  }

  filtrarEmpleados(): void {
    const term = this.empleadoBusqueda.trim().toLowerCase();
    if (!term) {
      this.empleadosFiltrados = [...this.empleados];
      return;
    }

    this.empleadosFiltrados = this.empleados.filter((empleado) =>
      empleado.nombreCompleto.toLowerCase().includes(term)
      || empleado.correo.toLowerCase().includes(term)
      || String(empleado.idUsuario).includes(term)
    );
  }

  get cargandoDatos(): boolean {
    return this.loadingPerfiles || this.loadingEmpleados;
  }

  private loadPerfiles(): void {
    this.loadingPerfiles = true;
    this.error = null;

    this.service.getPerfiles().subscribe({
      next: (res) => {
        this.perfiles = res ?? [];
        this.loadingPerfiles = false;
      },
      error: (err) => {
        this.loadingPerfiles = false;
        this.error = this.getErrorMessage(err) ?? 'No se pudo cargar el catalogo de perfiles.';
      }
    });
  }

  private loadEmpleados(): void {
    this.loadingEmpleados = true;
    this.error = null;

    this.personalService.getEmpleados().subscribe({
      next: (res: Empleado[]) => {
        this.empleados = (res ?? [])
          .filter((empleado) => Number(empleado?.idUsuario) > 0 && Number(empleado?.esOperativoCampo) === 0)
          .map((empleado) => ({
            idEmpleado: Number(empleado.idEmpleado),
            idUsuario: Number(empleado.idUsuario),
            nombreCompleto: `${empleado.nombre ?? ''} ${empleado.apellido ?? ''}`.trim(),
            correo: String(empleado.correo ?? ''),
            estado: String(empleado.estado ?? (Number(empleado.idEstado) === 1 ? 'Activo' : 'Inactivo'))
          }))
          .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

        this.empleadosFiltrados = [...this.empleados];
        this.loadingEmpleados = false;
      },
      error: (err) => {
        this.loadingEmpleados = false;
        this.error = this.getErrorMessage(err) ?? 'No se pudo cargar la lista de empleados.';
      }
    });
  }

  private getErrorMessage(err: unknown): string | null {
    const message = (err as { error?: ApiErrorResponse })?.error?.message;
    return typeof message === 'string' && message.trim().length > 0 ? message : null;
  }
}
