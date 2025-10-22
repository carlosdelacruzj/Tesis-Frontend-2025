import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { ProyectoService } from 'src/app/control-panel/gestionar-proyecto/service/proyecto.service';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Proyecto } from '../model/proyecto.model';
import { PedidoService } from '../service/pedido.service';
import { Pedido, Pedido2 } from '../model/pedido.model';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { NgForm } from '@angular/forms';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { formatDisplayDate } from '../../../shared/utils/date-utils';

@Component({
  selector: 'app-gestionar-proyecto',
  templateUrl: './gestionar-proyecto.component.html',
  styleUrls: ['./gestionar-proyecto.component.css'],
})
export class GestionarProyectoComponent implements OnInit {
  minimo: string;
  maximo: string;
  fechaFinEdicion: Date = new Date();
  fechaOk = '';
  displayedColumns = [
    'PK_Pro_Cod',
    'Pro_Nombre',
    'FK_P_Cod',
    'EPro_Fecha_Inicio_Edicion',
    'Pro_Fecha_Fin_Edicion',
    'actions',
  ];
  displayedColumns2 = [
    'ID',
    'Nombre',
    'Fecha',
    'Servicio',
    'Evento',
    'Cliente',
    'Estado',
    'EstadoPago',
    'actions',
  ];
  id2 = 0;
  dataSource!: MatTableDataSource<any>;
  dataSource2!: MatTableDataSource<any>;

  @ViewChild('paginator') paginator!: MatPaginator;
  @ViewChild('paginator2') paginator2!: MatPaginator;
  @ViewChild(MatSort) matSort!: MatSort;


  constructor(
    public service: ProyectoService,
    public service2: PedidoService,
    private modalService: NgbModal
  ) { }
  fechaActual = '';
  ngOnInit(): void {
    this.getProyecto();
    this.getPedido();
    // this.service.selectProyecto.Pro_Fecha_Fin_Edicion = this.fechaFinEdicion.toDateString();
    this.fechaValidate(this.fechaFinEdicion);
  }

  //Para las fechas

  fechaValidate(date) {
    this.minimo = this.addDaysToDate(date, 14);
    this.maximo = this.addDaysToDate(date, 365);
  }

  addDaysToDate(date, days) {
    var res = new Date(date);
    res.setDate(res.getDate() + days);
    return this.convert(res);
  }
  convert(str) {
    var date = new Date(str),
      mnth = ("0" + (date.getMonth() + 1)).slice(-2),
      day = ("0" + date.getDate()).slice(-2);
    return [date.getFullYear(), mnth, day].join("-");
  }

  // para llenar las tablas
  getProyecto() {
    this.service.getAllNombres().subscribe((response: any) => {
      this.dataSource = new MatTableDataSource(response);
      this.dataSource.paginator = this.paginator2;
      this.dataSource.sort = this.matSort;
    });
  }

  getPedido() {
    this.service2.getAllNombres().subscribe((response: any) => {
      this.dataSource2 = new MatTableDataSource(response);
      this.dataSource2.paginator = this.paginator;
      this.dataSource2.sort = this.matSort;
    });
  }

  // para hacer los filtros
  filterData($event: any) {
    this.dataSource.filter = $event.target.value;
  }
  filterData2($event: any) {
    this.dataSource2.filter = $event.target.value;
  }

  getProyecto1(proyecto: Proyecto) {
    this.service.selectProyecto = proyecto;
  }

  // para guardar el dato escogido
  getPedido1(pedido: Pedido) {
    this.service2.selectPedido = pedido;
    console.log(this.service2.selectPedido);
  }

  getPedidoID(valor: number) {
    this.service2.getAllNombresID(valor).subscribe((responde) => {
      const pedido = responde?.[0] ?? {};
      this.service2.selectPedido2 = {
        ...pedido,
        F_Registro: formatDisplayDate(pedido?.F_Registro, ''),
        F_Evento: formatDisplayDate(pedido?.F_Evento, ''),
      } as Pedido2;
    });
  }
  getProyectoID(valor: number) {
    this.service.getProyectoID(valor).subscribe((responde) => {
      this.service.selectProyecto = responde[0];
      this.service.selectProyecto.Pro_Fecha_Fin_Edicion = formatDisplayDate(responde?.[0]?.Pro_Fecha_Fin_Edicion, '');
      console.log(this.service.selectProyecto)

    })
  }

  //DESDE AQUI BORRAS
  closeResult = '';

  open(content: any, idpedido: number, idproyecto: number) {
    this.modalService.open(content);
    this.getPedidoID(idpedido);
    this.getProyectoID(idproyecto);

  }

  UpdateEmpleado(EmpleadoForm: NgForm, fecha: string, id: number) {
    // this.fechaOk = fecha.substr(6) + fecha.substr(2, 4) + fecha.substr(0, 2); //yyyy-MM-dd
    // console.log(id)
    // console.log(fecha);

    console.log(this.fechaFinEdicion);

    let data = {
      finFecha: this.service.selectProyecto.Pro_Fecha_Fin_Edicion,
      multimedia: 1,
      edicion: 1,
      enlace: EmpleadoForm.value.enlace,
      Observacion: 'Esto es una prueba',
      id: id
    };

    console.log(data);

    this.service.updateProyecto(data).subscribe((res) => {
      this.getProyecto();
      Swal.fire({
        text: 'Se actulizó al empleado exitosamente',
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
    )
  }
}
