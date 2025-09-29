import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Cliente } from './model/cliente.model';
import { ClienteService } from './service/cliente.service';
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
    public service: ClienteService
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
  public getByIdCliente(id: number) {
    this.service.getByIdCliente(id).subscribe((responde) => {
      this.service.selectCliente = responde[0];
      console.log(this.service.selectCliente);
    });
  }
}
