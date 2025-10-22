import { Component, Inject, Input, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EventoAllServiciosService } from '../../service/detalle-servicios.service';
import { EventoServicioService } from '../../service/evento-servicio.service';

interface sServicios {
  ID: number;
  Nombre: string;
}

@Component({
  selector: 'app-detalle-servicios',
  templateUrl: './detalle-servicios.component.html',
  styleUrls: ['./detalle-servicios.component.css'],
})
export class DetalleServiciosComponent implements OnInit {
  serviciosf = [];
  @Input() ID: number = 0;
  @Input() Nombre: string = '';

  sServicio=["filmacion","fotografia","Filmación y Fotografia"];

  constructor(
    public service: EventoAllServiciosService,
    private service2: EventoServicioService,
    public service4: EventoAllServiciosService,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<DetalleServiciosComponent>
  ) {}

  ngOnInit(): void {
    this.getSelect();
  }

  getSelect() {
    this.service.getAllServicios().subscribe(
      (res) => {
        // this.sServicio = res;
        console.log(res)
      },
      (err) => console.error(err)
    );
  }

  addServicio(ServicioForm: NgForm) {
    let data = {
      evento: this.data, //COLOCAR EL ID POR EL EVENTO A REGISTRAR
      servicio: 1,
      precio: ServicioForm.value.Precio,
      titulo: ServicioForm.value.Titulo,
      descripcion: ServicioForm.value.Descripcion,
    };
    this.service.registro(data).subscribe(
      (res) => {
        console.log('DATA: ', res);
        this.dialogRef.close();
      },
      (err) => console.error(err)
    );
  }
}
