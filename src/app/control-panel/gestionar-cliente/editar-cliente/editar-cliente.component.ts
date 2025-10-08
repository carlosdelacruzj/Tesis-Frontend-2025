import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { ClienteService } from '../service/cliente.service';
import swal from 'sweetalert2';

@Component({
  selector: 'app-editar-cliente',
  templateUrl: './editar-cliente.component.html',
  styleUrls: ['./editar-cliente.component.css']
})
export class EditarClienteComponent implements OnInit {

  nombrePattern = "^[a-zA-Z ]{2,20}$";
  apellidoPattern = "^[a-zA-Z ]{2,30}$";
  docPattern = "^[0-9]{1}[0-9]{7}$";
  celularPattern = "^[1-9]{1}[0-9]{6,8}$";
  correoPattern = "^[a-z]+[a-z0-9._]+@[a-z]+\.[a-z.]{2,5}$";

  constructor(public service: ClienteService) { }

  ngOnInit(): void {
  }
  public editCliente(clienteForm: NgForm): void {
    const data = {
      correo: clienteForm.value.correo,
      celular: clienteForm.value.celular,
      idCliente: this.service.selectCliente.idCliente,
      direccion: clienteForm.value.direccion
    };

    this.service.putClienteById(data).subscribe(
      (res: any): void => {
        // Si tu backend aún puede responder 200 con ok:false
        const isBackendError = res && res.ok === false;
        const msg = isBackendError
          ? (res.message || 'Ocurrió un error, volver a intentar.')
          : 'Actualización exitosa';

        swal.fire({
          text: msg,
          icon: isBackendError ? 'warning' : 'success',
          showCancelButton: false,
          customClass: {
            confirmButton: `btn btn-${isBackendError ? 'warning' : 'success'}`
          },
          buttonsStyling: false
        });
      },
      (err): void => {
        const msg = err?.error?.message || 'Ocurrió un error, volver a intentar.';
        swal.fire({
          text: msg,
          icon: 'warning',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-warning' },
          buttonsStyling: false
        });
      }
    );
  }
}
