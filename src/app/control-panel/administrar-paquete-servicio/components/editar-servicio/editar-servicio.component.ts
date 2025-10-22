import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { EventoAllServiciosService } from './../../service/detalle-servicios.service';

interface sServicios {
  ID: number;
  Nombre: string;
}
@Component({
  selector: 'app-editar-servicio',
  templateUrl: './editar-servicio.component.html',
  styleUrls: ['./editar-servicio.component.css'],
})
export class EditarServicioComponent implements OnInit {
  servicio = [];
  data: any;
  sServicio: sServicios[] = [];

  constructor(
    public service5: EventoAllServiciosService,
    public service: EventoAllServiciosService,
    public service4: EventoAllServiciosService
  ) {}

  ngOnInit(): void {
    this.getSelect();
  }

  getSelect() {
    this.service.getAllServicios().subscribe(
      (res) => {
        this.sServicio = res;
      },
      (err) => console.error(err)
    );
  }

  editarServicio(ServicioForm: NgForm) {
    let data = {
      //evento: ServicioForm.value.Evento,
      //servicio: ServicioForm.value.Servicio,

      /*
      servicio: ServicioForm.value.Servicio,
      titulo: ServicioForm.value.Titulo,
      precio: ServicioForm.value.Precio,  
      descripcion: ServicioForm.value.Descripcion,
      id: ServicioForm.value.ID
      */
      servicio: ServicioForm.value.Servicio,
      titulo: ServicioForm.value.Titulo,
      precio: ServicioForm.value.Precio,
      concepto: ServicioForm.value.Descripcion,
      id: ServicioForm.value.ID,
    };

    this.service4.registro2(data).subscribe(
      (res) => {
        console.log('DATA: ', res);
      },
      (err) => console.error(err)
    );
  }
}
