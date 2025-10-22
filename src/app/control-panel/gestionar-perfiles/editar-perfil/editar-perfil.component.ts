import { Component, OnInit } from '@angular/core';
import { PerfilService } from '../service/perfil.service';
import { NgForm, UntypedFormControl, Validators } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

interface roles {
  PK_Rol_Cod: number;
  Rol_Nombre: string;
}
@Component({
  selector: 'app-editar-perfil',
  templateUrl: './editar-perfil.component.html',
  styleUrls: ['./editar-perfil.component.css']
})
export class EditarPerfilComponent implements OnInit {

  rol=[];
  roles: roles[] = [];
  selectFormControl = new UntypedFormControl('', Validators.required);
  nombrePattern = "^[a-zA-Z ]{2,20}$"; 
  apellidoPattern = "^[a-zA-Z ]{2,30}$"; 
  docPattern = "^[0-9]{1}[0-9]{7}$"; 
  celularPattern = "^[1-9]{1}[0-9]{6,8}$"; 
  correoPattern = "^[a-z]+[a-z0-9._]+@[a-z]+\.[a-z.]{2,5}$"; 

  constructor(public service: PerfilService) { }

  ngOnInit(): void {
    this.getAllRoles();
  }
  public putPermiso(perfilForm: NgForm) {
    console.log(perfilForm.value);
    let data = {
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
  getAllRoles(){
    this.service.getAllRoles().subscribe(
      (res) => {
        this.roles = res;
      },
      (err) => console.error(err)
    );
  }
  clear(perfilForm: NgForm){
    perfilForm.reset();
 }
}
