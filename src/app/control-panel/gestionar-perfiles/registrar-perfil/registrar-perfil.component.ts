import { Component, OnInit } from '@angular/core';
import { PerfilService } from '../service/perfil.service';
import { NgForm, UntypedFormControl, Validators } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';

interface roles {
  PK_Rol_Cod: number;
  Rol_Nombre: string;
}
@Component({
  selector: 'app-registrar-perfil',
  templateUrl: './registrar-perfil.component.html',
  styleUrls: ['./registrar-perfil.component.css']
})
export class RegistrarPerfilComponent implements OnInit {

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

  postPermiso(PerfilForm: NgForm) {
    let data = {
      nombre: PerfilForm.value.nombre,
      apellido: PerfilForm.value.apellido,
      correo: PerfilForm.value.correo,
      celular: PerfilForm.value.celular,
      doc: PerfilForm.value.doc,
      
      direccion: PerfilForm.value.direccion,
      rol: PerfilForm.value.rol,
    };
    console.log(data);
    this.service.postPermiso(data).subscribe(
      (res) => { 
      this.clear(PerfilForm);
      Swal.fire({
        text: 'Registro exitoso',
        icon: 'success',
        showCancelButton: false,
        customClass: {
            confirmButton: 'btn btn-success',
        },
        buttonsStyling: false
    });
    },
      (err) => {console.error(err)
        Swal.fire({
          text: 'Ocurrió un error, volver a intentar.',
          icon: 'warning',
          showCancelButton: false,
          customClass: {
              confirmButton: 'btn btn-warning',
          },
          buttonsStyling: false
      });
      }
    );
  }

  getAllRoles(){
    this.service.getAllRoles().subscribe(
      (res) => {
        this.roles = res;
      },
      (err) => console.error(err)
    );
  }
  clear(ClienteForm: NgForm){
    ClienteForm.reset();
 }

}
