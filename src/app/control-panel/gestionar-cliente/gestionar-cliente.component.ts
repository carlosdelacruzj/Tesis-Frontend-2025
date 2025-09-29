import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { ProyectoService } from 'src/app/control-panel/gestionar-proyecto/service/proyecto.service';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Cliente } from './model/cliente.model';
import { ClienteService } from './service/cliente.service';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { NgForm } from '@angular/forms';
@Component({
  selector: 'app-gestionar-cliente',
  templateUrl: './gestionar-cliente.component.html',
  styleUrls: ['./gestionar-cliente.component.css']
})
export class GestionarClienteComponent implements OnInit {

  clientes: Cliente[]
  displayedColumns2 = [
    'codigoCliente',
    'nombre',
    'apellido',
    'correo',
    'celular',
    'doc',
    'direccion',
    'actions',
  ];
  id2 = 0;
  dataSource = new MatTableDataSource<Cliente>([]);

  @ViewChild('paginator') paginator!: MatPaginator;
  @ViewChild(MatSort) matSort!: MatSort;

  constructor(
    public service: ClienteService,
    private modalService: NgbModal
  ) { }
  fechaActual = '';
  async ngOnInit() {
    await this.getAllClientes();
  }
  trackById(index: number, row: any) { return row.idCliente; }

  async getAllClientes() {
    var data = await this.service.getAllClientes();
    this.dataSource.data = data;
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.matSort;
  }
  // para hacer los filtros
  applyFilter($event: Event) {
    const filterValue = ($event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
  //DESDE AQUI BORRAS
  closeResult = '';

  private getDismissReason(reason: any): string {
    if (reason === ModalDismissReasons.ESC) {
      return 'by pressing ESC';
    } else if (reason === ModalDismissReasons.BACKDROP_CLICK) {
      return 'by clicking on a backdrop';
    } else {
      return `with: ${reason}`;
    }
  }

  public getByIdCliente(id: number) {
    this.service.getByIdCliente(id).subscribe((responde) => {
      this.service.selectCliente = responde[0];
      console.log(this.service.selectCliente);
    });
  }
}
