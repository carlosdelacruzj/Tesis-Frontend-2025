import { Component, OnInit, inject } from '@angular/core';
import { PerfilService } from '../service/perfil.service';
import { NgForm, UntypedFormControl, Validators } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

interface Rol {
  PK_Rol_Cod: number;
  Rol_Nombre: string;
}
@Component({
  selector: 'app-editar-perfil',
  templateUrl: './editar-perfil.component.html',
  styleUrls: ['./editar-perfil.component.css']
})
export class EditarPerfilComponent implements OnInit {

  rol: Rol[] = [];
  roles: Rol[] = [];
  selectFormControl = new UntypedFormControl('', Validators.required);
  nombrePattern = '^[a-zA-Z ]{2,20}$';
  apellidoPattern = '^[a-zA-Z ]{2,30}$';
  docPattern = '^[0-9]{1}[0-9]{7}$';
  celularPattern = '^[1-9]{1}[0-9]{6,8}$';
  correoPattern = '^[a-z]+[a-z0-9._]+@[a-z]+\\.[a-z.]{2,5}$';

  readonly service = inject(PerfilService);

  ngOnInit(): void {
    this.getAllRoles();
  }
  public putPermiso(perfilForm: NgForm) {
    console.log(perfilForm.value);
    const data = {
      Correo: perfilForm.value.correo,
      Celular: perfilForm.value.celular,
      ID: perfilForm.value.ID,
      Direccion: perfilForm.value.direccion,
      rol: perfilForm.value.ROL,

    };
    console.log(data);
    try {
      this.service.putPermiso(data).subscribe();
      Swal.fire({
        text: 'Actualización exitosa',
        icon: 'success',
        showCancelButton: false,
        customClass: {
          confirmButton: 'btn btn-success',
        },
        buttonsStyling: false
      });
    }
    catch (err) {
      console.log(err);
    }
  }
  getAllRoles() {
    this.service.getAllRoles().subscribe(
      (res) => {
        this.roles = this.mapRoles(res);
      },
      (err) => console.error(err)
    );
  }
  clear(perfilForm: NgForm){
    perfilForm.reset();
 }

  private mapRoles(value: Record<string, unknown>[] | null | undefined): Rol[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((item) => ({
      PK_Rol_Cod: Number(item?.PK_Rol_Cod ?? item?.id ?? 0) || 0,
      Rol_Nombre: String(item?.Rol_Nombre ?? item?.nombre ?? '')
    }));
  }
}
