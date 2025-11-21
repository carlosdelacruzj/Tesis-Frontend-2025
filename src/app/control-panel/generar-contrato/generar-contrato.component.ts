import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { PedidoService } from './service/pedido.service';
import { Pedido2 } from './model/pedido.model';
import { formatDisplayDate } from '../../shared/utils/date-utils';

@Component({
  selector: 'app-generar-contrato',
  templateUrl: './generar-contrato.component.html',
  styleUrls: ['./generar-contrato.component.css'],
})
export class GenerarContratoComponent implements OnInit {
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
  id2 =0;
  dataSource2!: MatTableDataSource<any>;

  @ViewChild('paginator') paginator!: MatPaginator;
  @ViewChild(MatSort) matSort!: MatSort;

  constructor(
    public service2: PedidoService
  ) {}
  fechaActual = '';
  ngOnInit(): void {
    this.getPedido();
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
    this.dataSource2.filter = $event.target.value;
  }

  // para guardar el dato escogido
  getPedidoID(valor: number) {
    this.service2.getAllNombresID(valor).subscribe((responde) => {
      const pedido = responde?.[0] ?? {};
      this.service2.selectPedido2 = {
        ...pedido,
        F_Registro: formatDisplayDate(pedido?.F_Registro, ''),
        F_Evento: formatDisplayDate(pedido?.F_Evento, ''),
      } as Pedido2;
      console.log(this.service2.selectPedido2);
    });
  }
}
