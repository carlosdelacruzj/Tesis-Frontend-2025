import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { GestionarEquipos } from './service/gestionar-equipos.service';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';

@Component({
  selector: 'app-gestionar-equipos',
  templateUrl: './gestionar-equipos.component.html',
  styleUrls: ['./gestionar-equipos.component.css'],
})
export class GestionarEquiposComponent implements OnInit, AfterViewInit {
  @ViewChild('projectsSort') projectsSort?: MatSort;
  @ViewChild('assignedSort') assignedSort?: MatSort;
  @ViewChild('availableSort') availableSort?: MatSort;

  @ViewChild('projectsPaginator') projectsPaginator?: MatPaginator;
  @ViewChild('assignedPaginator') assignedPaginator?: MatPaginator;
  @ViewChild('availablePaginator') availablePaginator?: MatPaginator;
  dataSource!: MatTableDataSource<any>;
  dataSource2!: MatTableDataSource<any>;
  dataSource3!: MatTableDataSource<any>;
  proyectos = [];
  equipos_proyecto = [];
  columnsToDisplay = [
    'nombre',
    'fecha',
    'servicio',
    'evento',
    'estado',
    'asignar',
  ];
  columnsToDisplay2 = ['codigo', 'marca', 'modelo', 'estado'];
  columnsToDisplay3 = [
    'empleado',
    'codequipo',
    'tipoequipo',
    'nombreequipo',
    'eliminar',
  ];
  asignarPersonal = false;
  proyecto = {
    Nombre: '',
  };
  id_proyecto = 0;
  id_empleado = 1;
  id_tipo_equipo = 1;
  empleados: any[] = [];
  tipo_equipos: any[] = [];
  ready_empleados = false;
  ready_proyectos = false;
  asignar_equipo = false;
  equipos = [];
  lista_id: any[] = [];
  fecha_proyecto = '';
  cantidad_asigacion = 0;
  fechaok="";
  constructor(private service: GestionarEquipos) {}

  ngOnInit(): void {
    this.asignarPersonal = false;
    this.ready_proyectos = false;
    this.ready_empleados = false;
    this.asignar_equipo = false;
    this.id_empleado = 1;
    this.id_tipo_equipo = 1;
    this.getProyectos();
    this.getEquiposId(1);
  }

  ngAfterViewInit(): void {
    this.bindMainTable();
    this.bindAssignedTable();
    this.bindAvailableTable();
  }

  // GET DATA

  // GET TODOS LOS PROYECTOS
  // getProyectos() {
  //   this.service.getAll().subscribe((data) => {
  //     this.proyectos = data;

  //   });
  // }
  getProyectos() {
    this.service.getAll().subscribe((response: any) => {
      this.dataSource = new MatTableDataSource(response);
      this.bindMainTable();
    });
  }

  
  filterData($event: any) {
    this.dataSource.filter = $event.target.value;
  }
  filterData2($event: any) {
    this.dataSource2.filter = $event.target.value;
  }
  filterData3($event: any) {
    this.dataSource3.filter = $event.target.value;
  }

  //GET PROYECTO POR ID
  getProyecto(id: number) {
    this.service.getById(id).subscribe((data) => {
      this.proyecto = {
        Nombre: data[0].Pro_Nombre,
      };
      //GET TODOS LOS EMPLEADOS
      this.service.getEmpleados().subscribe((data) => {
        this.empleados = data;
        this.ready_proyectos = true;
        this.ready_empleados = true;
      });

      //GET EQUIPOS BY PROYECTO ID

      // this.service.getEquiposByProyecto(id).subscribe((data) => {
      //   this.equipos_proyecto = data;
      //   this.cantidad_asigacion = this.equipos_proyecto.length;
      // });

      this.service.getEquiposByProyecto(id).subscribe((response: any) => {
        this.dataSource2 = new MatTableDataSource(response);
        this.bindAssignedTable();
        this.equipos_proyecto = response;
        this.cantidad_asigacion = this.equipos_proyecto.length;
      });
    });
  }

  //GET TIPOS DE EQUIPOS
  getTiposEquipos() {
    this.service.getTiposEquipo().subscribe((data) => {
      this.tipo_equipos = data;
    });
  }

  //GET TIPOS DE EQUIPOS BY ID

  // getEquiposId(id: number) {
  //   this.service
  //     .getEquipoId(this.fecha_proyecto, this.id_proyecto, id)
  //     .subscribe((data) => {
  //       this.equipos = data;
  //     });
  // }

  getEquiposId(id: number) {
  
    this.fechaok = this.fecha_proyecto.substr(6) + this.fecha_proyecto.substr(2, 4) + this.fecha_proyecto.substr(0, 2); //yyyy-MM-dd
   console.log(this.fechaok);
    this.service
      .getEquipoId(this.fechaok, this.id_proyecto, id)
      .subscribe((response: any) => {
        this.dataSource3 = new MatTableDataSource(response);
        this.bindAvailableTable();
        this.equipos = response;

      });
  }

  //ABRIR VENTAN PARA ASIGNAR PERSONAL
  ventanaAsignarPersonal(valor: number, fecha: string) {
    this.asignarPersonal = true;
    this.fecha_proyecto = fecha;
    this.id_proyecto = valor;
    this.getProyecto(valor);
  }

  //CERRAR VENTANA PARA ASIGNAR PERSONAL

  closeAsignarPersonal() {
    this.getProyectos();
    this.asignarPersonal = false;
    this.ready_proyectos = false;
    this.ready_empleados = false;
  }

  //ABRIR VENTANA ASIGNAR EQUIPO
  ventanaAsignarEquipo() {
    if (this.id_empleado != 0) {
      this.asignar_equipo = true;
      this.getTiposEquipos();
      this.getEquiposId(1);
    }
  }

  //CERRAR VENTANA ASIGNAR EQUIPOS
  closeAsingarEquipo() {
    this.asignar_equipo = false;
  }

  asignarEmpleado(event: number) {
    this.id_empleado = event;
  }

  asignarTipoEquipo(event: number) {
    this.id_tipo_equipo = event;
    this.getEquiposId(event);
  }

  registrarData(id_empleado: number, id_proyecto: number, id_equipo: string) {
    this.service
      .postEquiposProyectos(id_proyecto, id_empleado, id_equipo)
      .subscribe({
        next: () => {
          this.getProyecto(this.id_proyecto);
          this.getEquiposId(this.id_tipo_equipo);
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  eliminarAsignacion(id: number) {
    this.service.deleteAsignacion(id).subscribe({
      next: (data) => {
        this.getProyecto(this.id_proyecto);
      },
      error: (error) => {
        console.error(error);
      },
      });
  }

  private bindMainTable(): void {
    if (this.dataSource) {
      if (this.projectsPaginator) {
        this.dataSource.paginator = this.projectsPaginator;
      }
      if (this.projectsSort) {
        this.dataSource.sort = this.projectsSort;
      }
    }
  }

  private bindAssignedTable(): void {
    if (this.dataSource2) {
      if (this.assignedPaginator) {
        this.dataSource2.paginator = this.assignedPaginator;
      }
      if (this.assignedSort) {
        this.dataSource2.sort = this.assignedSort;
      }
    }
  }

  private bindAvailableTable(): void {
    if (this.dataSource3) {
      if (this.availablePaginator) {
        this.dataSource3.paginator = this.availablePaginator;
      }
      if (this.availableSort) {
        this.dataSource3.sort = this.availableSort;
      }
    }
  }
}
