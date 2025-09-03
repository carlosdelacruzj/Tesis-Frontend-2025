import { Component, Input, OnInit } from '@angular/core';
import { ProyectoService } from '../service/proyecto.service';
import { FormGroup, NgForm } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { Proyecto } from '../model/proyecto.model';
import { PedidoService } from '../service/pedido.service';
import { Pedido } from '../model/pedido.model';
import { DateAdapter } from '@angular/material/core';
import { DatePipe } from '@angular/common';
import swal from 'sweetalert2';

interface Food {
  value: string;
  viewValue: string;
}

@Component({
  selector: 'app-agregar-proyecto',
  templateUrl: './agregar-proyecto.component.html',
  styleUrls: ['./agregar-proyecto.component.css'],
})
export class AgregarProyectoComponent implements OnInit {

  fechaOk = '';
  proyectos = [];
  btnDisabled = false;
  foods: Food[] = [
    { value: 'steak-0', viewValue: '1' },
    { value: 'pizza-1', viewValue: '2' },
    { value: 'tacos-2', viewValue: '3' },
  ];
  constructor(
    public service: ProyectoService,
    public service2: PedidoService,
    private dateAdapter: DateAdapter<Date>,
    private datePipe: DatePipe
  ) {
    this.dateAdapter.setLocale('es');
  }

  ngOnInit(): void { }

  addProyecto(ProyectoForm: NgForm, fecha: string) {
    //Para poder cambiar el orden de como mando la fecha

    // console.log(fecha.substr(2,4)); //-MM-
    // console.log(fecha.substr(0,2)); //dd
    // console.log(fecha.substr(6)); //yyyy
    this.fechaOk = fecha.substr(6) + fecha.substr(2, 4) + fecha.substr(0, 2); //yyyy-MM-dd

    let data = {
      proyecto_nombre: ProyectoForm.value.NombrePedido,
      codigo_pedido: ProyectoForm.value.ID,
      fecha_inicio_edicion: this.fechaOk,
    };
    console.log("aaaaaah")
    console.log(data);
    this.service.registro(data).subscribe(
      (res) => {
        console.log('DATA: ', res);
        this.btnDisabled = true;
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
        console.error(err)
        swal.fire({
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
 
 
    



}
