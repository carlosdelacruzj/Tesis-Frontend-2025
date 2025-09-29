import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ClienteService } from '../service/cliente.service';
import swal from 'sweetalert2';

@Component({
  selector: 'app-registrar-cliente',
  templateUrl: './registrar-cliente.component.html',
  styleUrls: ['./registrar-cliente.component.css', '../clientes-common.css']
})
export class RegistrarClienteComponent implements OnInit {

  nombrePattern = "^[a-zA-Z ]{2,20}$";
  apellidoPattern = "^[a-zA-Z ]{2,30}$";
  docPattern = "^[0-9]{1}[0-9]{7}$";
  celularPattern = "^[1-9]{1}[0-9]{6,8}$";
  correoPattern = "^[a-z]+[a-z0-9._]+@[a-z]+\.[a-z.]{2,5}$";

  constructor(public service: ClienteService) { }

  ngOnInit(): void {
  }

  addCliente(ClienteForm: NgForm) {
    let data = {
      nombre: ClienteForm.value.nombre,
      apellido: ClienteForm.value.apellido,
      correo: ClienteForm.value.correo,
      numDoc: ClienteForm.value.doc,
      celular: ClienteForm.value.celular,
      direccion: ClienteForm.value.direccion,
    };
    console.log(data);
    this.service.addCliente(data).subscribe(
      (res) => {
        this.clear(ClienteForm);
        swal.fire({
          text: 'Registro exitoso',
          icon: 'success',
          showCancelButton: false,
          customClass: {
            confirmButton: 'btn btn-success',
          },
          buttonsStyling: false
        });
      },
      (err) => {
        const msg = err?.error?.message || 'Ocurrió un error, volver a intentar.';
        swal.fire({
          text: msg, icon: 'warning', showCancelButton: false,
          customClass: { confirmButton: 'btn btn-warning' }, buttonsStyling: false
        });
      }

    );
  }
  clear(ClienteForm: NgForm) {
    ClienteForm.reset();
  }
}
