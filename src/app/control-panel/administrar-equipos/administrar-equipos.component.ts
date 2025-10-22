import { formatDate } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NgbModal, NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import { AdministrarEquiposService } from './service/service.service';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { TableColumn } from 'src/app/components/table-base-mejora/table-base-mejora.component';

interface TEquipo {
  PK_TE_Cod: number;
  TE_Nombre: string;
}

interface MEquipo {
  Id: number;
  Nombre: string;
}

interface Proyecto {
  ID: number;
  Nombre: string;
  Fecha: string;
  Servicio: string;
  Evento: string;
  Estado: number;
}

interface Empleado {
  ID: number;
  Nombre: string;
  Apellido: string;
  Car_Nombre: string;
  DNI: string;
  Celular: string;
  Correo: string;
  Autonomo: number;
  Cargo: string;
  Estado: string;
}

interface EquipoGrupoRow {
  tipoEquipo?: string;
  marca?: string;
  modelo?: string;
  cantidad?: number;
  idTipoEquipo?: number;
  idMarca?: number;
  idModelo?: number;
  IdEquipo?: number;
  IdMarca?: number;
  IdModelo?: number;
  Modelo?: string;
}

interface EquipoAlquiladoRow {
  tipoEquipo?: string;
  serie?: string;
  proyectoAsig?: string;
  empleadoAsig?: string;
  estado?: string;
  id?: number;
  ID?: number;
  Serie?: string;
}

@Component({
  selector: 'app-administrar-equipos',
  templateUrl: './administrar-equipos.component.html',
  styleUrls: ['./administrar-equipos.component.css'],
})
export class AdministrarEquiposComponent implements OnInit {
  /** Datos para las tablas reutilizables */
  equiposAdquiridos: EquipoGrupoRow[] = [];
  equiposAlquilados: EquipoAlquiladoRow[] = [];

  /** Definición de columnas para tabla base */
  readonly columnasAdquiridos: TableColumn<EquipoGrupoRow>[] = [
    { key: 'tipoEquipo', header: 'Equipo', sortable: true, class: 'text-center text-capitalize' },
    { key: 'marca', header: 'Marca', sortable: true, class: 'text-center text-capitalize' },
    { key: 'modelo', header: 'Modelo', sortable: true, class: 'text-center text-capitalize' },
    { key: 'cantidad', header: 'Cantidad', sortable: true, class: 'text-center', width: '120px' },
    { key: 'acciones', header: 'Ver', sortable: false, filterable: false, class: 'text-center', width: '110px' }
  ];

  readonly columnasAlquilados: TableColumn<EquipoAlquiladoRow>[] = [
    { key: 'tipoEquipo', header: 'Equipo', sortable: true, class: 'text-center text-capitalize' },
    { key: 'serie', header: 'N° Serie', sortable: true, class: 'text-center text-capitalize' },
    { key: 'proyectoAsig', header: 'Proyecto Asignado', sortable: true, class: 'text-center text-capitalize' },
    { key: 'empleadoAsig', header: 'Empleado Asignado', sortable: true, class: 'text-center text-capitalize' },
    { key: 'estado', header: 'Estado', sortable: true, class: 'text-center text-capitalize', width: '140px' },
    { key: 'acciones', header: 'Detalle', sortable: false, filterable: false, class: 'text-center', width: '110px' }
  ];

  //VALIDACION DE FECHA
  minimo: string = '';
  maximo: string = '';
  fechaFinEdicion: Date = new Date();

  @Input() estado = 'ALQUILADO';

  proyecto: Proyecto[] = [];
  empleado: Empleado[] = [];
  equipos: TEquipo[] = [];
  marcas: MEquipo[] = [];
  esPrincipal: boolean = true;
  isPrincipal: boolean = true;
  idEquipo: number = 0;
  idMarca: number = 0;
  idModelo: number = 0;
  Modelo: string = '';
  id: number = 0;
  serie: string = '';
  seriePattern = '^[A-Z]{3,3}[-]{1,1}[0-9]{3,3}$';

  hoy: number = Date.now();

  sHoy = '';
  existe: number = 0;

  idProyecto: number = 0;

  constructor(
    public service: AdministrarEquiposService,
    config: NgbModalConfig,
    private modalService: NgbModal
  ) {
    config.backdrop = 'static';
    config.keyboard = false;

    this.sHoy = formatDate(this.hoy, 'yyyy-MM-dd', 'en-US');
  }

  ngOnInit(): void {
    this.getEquipos();
    this.getEquiposAlquilados();
    this.getTipoEquipos();
    this.getMarcaEquipos();
    //VALIDACION DE FECHA
    this.fechaValidate(this.fechaFinEdicion);
  }
  //VALIDACION DE FECHA
  fechaValidate(date:any) {

    this.minimo = this.addDaysToDate(date, 1);
    this.maximo = this.addDaysToDate(date, 365);
  }

  addDaysToDate(date:any, days:any) {
    var res = new Date(date);
    res.setDate(res.getDate() + days);
    return this.convert(res);
  }
  convert(str:any) {
    var date = new Date(str),
      mnth = ("0" + (date.getMonth() + 1)).slice(-2),
      day = ("0" + date.getDate()).slice(-2);
    return [date.getFullYear(), mnth, day].join("-");
  }
  //FIN VALIDACION DE FECHA
  //Muestra de tabla equipos adquiridos
  getEquipos() {
    this.service.getAllGroup().subscribe((response: any) => {
      console.log(response);
      this.equiposAdquiridos = response || [];
    });
  }
  getEmpleados() {
    this.service.getAllEmpleados().subscribe((response) => {
      this.empleado = response;
    });
  }
  getProyectos() {
    this.service.getAllProyectos().subscribe((response) => {
      this.proyecto = response;
    });
  }

  //Muestra la tabla de equipos alquilados
  getEquiposAlquilados() {
    this.service.getEquiposAlquilados().subscribe((response: any) => {
      this.equiposAlquilados = response || [];
    });
  }
  //
  getTipoEquipos() {
    this.service.getTipoEquipo().subscribe((response) => {
      this.equipos = response;
    });
  }
  getMarcaEquipos() {
    this.service.getMarcaEquipo().subscribe((response) => {
      this.marcas = response;
    });
  }
  //Segunda vista
  verDetalle(
    idEquipo: number,
    idMarca: number,
    idModelo: number,
    Modelo: string
  ) {
    this.esPrincipal = false;
    this.idEquipo = idEquipo;
    this.idMarca = idMarca;
    this.idModelo = idModelo;
    this.Modelo = Modelo;
  }
  seleccionarGrupo(row: EquipoGrupoRow) {
    if (!row) { return; }
    const idEquipo = row.idTipoEquipo ?? row.IdEquipo;
    const idMarca = row.idMarca ?? row.IdMarca;
    const idModelo = row.idModelo ?? row.IdModelo;
    const modelo = row.modelo ?? row.Modelo ?? '';
    if (idEquipo != null && idMarca != null && idModelo != null) {
      this.verDetalle(idEquipo, idMarca, idModelo, modelo);
    }
  }
  seleccionarAlquilado(row: EquipoAlquiladoRow) {
    if (!row) { return; }
    const id = row.id ?? row.ID;
    const serie = row.serie ?? row.Serie ?? '';
    if (id != null) {
      this.verDetalleAlquilado(id, serie);
    }
  }
  //vISTA ALQUILDO
  verDetalleAlquilado(id: number, serie: string) {
    this.isPrincipal = false;
    this.id = id;
    this.serie = serie;
  }

  registrarAlquilado(content: any) {
    this.modalService.open(content);
    this.getProyectos();
    this.getEmpleados();
    this.service.postAlquilado.estado = this.estado;
    this.service.postAlquilado.fechaEntrada = this.sHoy;
  }
  //Selector de seria devuelve. Existe = 1 | No existe = 0
  getSerie1(idEquipo: string) {
    this.service.getExisteSerie(idEquipo).subscribe((response) => {
      this.existe = response;
      console.log(this.existe)
    });
  }
  clear(equipoForm: NgForm) {
    equipoForm.reset();
  }
  //Registro de equipo Alquilado
  addAlquilado(equipoForm: NgForm) {
    this.getSerie1(equipoForm.value.serie)
    console.log(this.existe)
    //inicio
    if (this.existe === 1) {
      Swal.fire({
        text: 'La serie ingresada ya existe',
        icon: 'warning',
        showCancelButton: false,
        customClass: {
          confirmButton: 'btn btn-warning',
        },
        buttonsStyling: false,
      });
    } else if (this.existe === 0) {//FINNNN
      Swal
        .fire({
          title: 'Esta seguro del registro?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Si, registrar ahora!',
          cancelButtonText: 'Cancelar',
        })
        .then((options) => {
          if (options.isConfirmed) {
            Swal.fire({
              text: 'Registro exitoso',
              icon: 'success',
              showCancelButton: false,
              customClass: {
                confirmButton: 'btn btn-success',
              },
              buttonsStyling: false,
            });
            let data = {
              tipoEquipo: equipoForm.value.tipoEquipo,
              marca: equipoForm.value.marca,
              modelo: equipoForm.value.modelo,
              serie: equipoForm.value.serie,
              fechaEntrada: equipoForm.value.fechaEntrada,
              fechaSalida: equipoForm.value.fechaSalida,
              fk_Pro_Cod: equipoForm.value.fk_Pro_Cod,
              fk_Empleado_Cod: equipoForm.value.fk_Empleado_Cod,
              estado: equipoForm.value.estado,
            };
            this.service.rEquipoA(data).subscribe(
              (res) => {
                console.log('DATA: ', res);
                this.clear(equipoForm);
                this.getEquipos();
                this.getEquiposAlquilados();
                this.getTipoEquipos();
                this.getMarcaEquipos();
              },
              (err) => {
                console.error(err);
                Swal.fire({
                  text: 'Ocurrió un error, volver a intentar.',
                  icon: 'warning',
                  showCancelButton: false,
                  customClass: {
                    confirmButton: 'btn btn-warning',
                  },
                  buttonsStyling: false,
                });
              }
            );
          }
        });
        //INICIO
      }
      //FINNNNNNNNNN
  }
}
