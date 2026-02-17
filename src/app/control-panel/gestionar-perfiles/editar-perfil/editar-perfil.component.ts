import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { ApiErrorResponse, PerfilUsuario } from '../model/perfil.model';
import { PerfilService } from '../service/perfil.service';

@Component({
  selector: 'app-editar-perfil',
  templateUrl: './editar-perfil.component.html',
  styleUrls: ['./editar-perfil.component.css']
})
export class EditarPerfilComponent implements OnInit {

  usuarioId: number | null = null;
  correo = '';
  perfilesUsuario: PerfilUsuario[] = [];
  loading = false;
  updating = false;
  error: string | null = null;

  private readonly service = inject(PerfilService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    const queryUsuarioId = Number(this.route.snapshot.queryParamMap.get('usuarioId'));
    if (Number.isFinite(queryUsuarioId) && queryUsuarioId > 0) {
      this.usuarioId = queryUsuarioId;
      this.consultar();
    }
  }

  consultar(): void {
    if (!this.usuarioId || this.usuarioId <= 0) {
      this.error = 'Ingresa un usuarioId valido.';
      this.perfilesUsuario = [];
      this.correo = '';
      return;
    }

    this.loading = true;
    this.error = null;

    this.service.getUsuarioPerfiles(this.usuarioId).subscribe({
      next: (res) => {
        this.correo = res?.usuario?.correo ?? '';
        this.perfilesUsuario = res?.perfiles ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = this.getErrorMessage(err) ?? 'No se pudieron consultar los perfiles del usuario.';
        this.perfilesUsuario = [];
        this.correo = '';
      }
    });
  }

  marcarPrincipal(perfilCodigo: string): void {
    if (!this.usuarioId || this.updating) {
      return;
    }

    this.updating = true;
    this.service.asignarPerfilPorCodigo(this.usuarioId, perfilCodigo, true).subscribe({
      next: () => {
        this.updating = false;
        void Swal.fire({ text: 'Perfil principal actualizado.', icon: 'success', confirmButtonText: 'Ok' });
        this.consultar();
      },
      error: (err) => {
        this.updating = false;
        const message = this.getErrorMessage(err) ?? 'No se pudo actualizar el perfil principal.';
        void Swal.fire({ text: message, icon: 'warning', confirmButtonText: 'Ok' });
      }
    });
  }

  remover(perfilCodigo: string): void {
    if (!this.usuarioId || this.updating) {
      return;
    }

    this.updating = true;
    this.service.removerPerfil(this.usuarioId, perfilCodigo).subscribe({
      next: () => {
        this.updating = false;
        void Swal.fire({ text: 'Perfil removido.', icon: 'success', confirmButtonText: 'Ok' });
        this.consultar();
      },
      error: (err) => {
        this.updating = false;
        const message = this.getErrorMessage(err) ?? 'No se pudo remover el perfil.';
        void Swal.fire({ text: message, icon: 'warning', confirmButtonText: 'Ok' });
      }
    });
  }

  private getErrorMessage(err: unknown): string | null {
    const message = (err as { error?: ApiErrorResponse })?.error?.message;
    return typeof message === 'string' && message.trim().length > 0 ? message : null;
  }
}
