import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { EventoServicioService } from '../../service/evento-servicio.service';
import { Detalle } from '../../model/detalle-servicios.model';
import { EventoAllServiciosService } from './../../service/detalle-servicios.service';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { NgForm } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { DetalleServiciosComponent } from '../detalle-servicios/detalle-servicios.component';

@Component({
  selector: 'app-event-service',
  templateUrl: './event-service.component.html',
  styleUrls: ['./event-service.component.css']
})
export class EventServiceComponent implements OnInit {

  id2 =0;
  servicios = [];
  columnsToDisplay = ['evento','precio', 'descripcion','titulo','acciones']
  dataSource2! : MatTableDataSource<any>;

  @ViewChild('paginator') paginator!: MatPaginator;
  @ViewChild(MatSort) matSort!: MatSort;


  // @Input() evento: string='';
  // @Input() servicio: string='';
  // @Input() precio: string='';
  // @Input() descripcion: string='';
  // @Input() titulo: string='';
  @Input() id: number = 0;


  base: boolean = true;
  servicioId = 0;
  @Input() ID: number = 0;
  @Output() emitAccion: EventEmitter<number> = new EventEmitter();


  constructor(private service: EventoServicioService, 
    private service3: EventoAllServiciosService, 
    public service4: EventoAllServiciosService,
    private modalService: NgbModal,
    private cdRef: ChangeDetectorRef,
    public dialog: MatDialog) { }
  // ngDoCheck(): void {
  //   console.log('CHANGE', this.changeTable);
  //   if(this.changeTable) {
  //     console.log('ENTRO');
  //     this.getServicio();
      
  //     this.changeTable = false;
  //   }
  // }

  ngOnInit(): void {
    console.log("EVENT SERVICE  ID: " + this.id);
    /* 
      1. Obtengo el id
      2. llamo a mi servicio detalle con el id que obtengo
      3. Muestras en la tabla la de tu servicio
    */
    this.getServicio();
  }
  getServicio() {
      this.service.api(this.id).subscribe((response:any) => {
        this.servicios = response;
      console.log("RESPONSE> " + this.servicios);
      this.dataSource2 = new MatTableDataSource(response);
      this.dataSource2.paginator = this.paginator;
      this.dataSource2.sort = this.matSort;
      this.cdRef.detectChanges();
  });
  }

  getServicio1(servicio: Detalle) {
    this.service3.selectProyecto = servicio;
    console.log(this.service3.selectProyecto);
  }

  filterData2($event: any) {
    this.dataSource2.filter = $event.target.value;
  }

  getServicioID(valor: number) {
    this.service4.getAllNombresID(valor).subscribe((responde) => {
      this.service4.selectProyecto = responde[0];
      console.log(this.service4.selectProyecto);
    });
  
  }

  closeResult = '';
  open(content: any,id: number) {
    this.modalService
      .open(content, { ariaLabelledBy: 'modal-basic-title' })
      .result.then(
        (result) => {
          this.closeResult = `Closed with: ${result}`;
        },
        (reason) => {
          this.closeResult = `Dismissed ${this.getDismissReason(reason)}`;
        }
      );
      this.id2 = id;
      this.service.selectProyecto.ID = this.id2;
  }

  private getDismissReason(reason: any): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }
  
  updateProyecto(ProyectoForm2: NgForm) {
    let data = {
      id: ProyectoForm2.value.id,
      nombreProyecto: ProyectoForm2.value.ID,
      fechaFinEdicion: ProyectoForm2.value.F_Evento
    };
    console.log(data);
    // this.service.registro(data).subscribe(
    //   (res) => { console.log("DATA: ", res)},
    //   (err) => console.error(err)
    // );
  }

  openDialog() {
    const dialogPaq = this.dialog.open(DetalleServiciosComponent,{data:this.id});
    dialogPaq.afterClosed().subscribe(resp =>{
      console.log('SE CERRÓ');
      this.getServicio();
    })
    
  }

  cambioVista(){
    this.emitAccion.emit(this.ID);
    alert(this.ID);
  }

  prueba(event: number){  
    this.base = false; this.servicioId = event; console.log("Id: ", this.servicioId)
  }

}
