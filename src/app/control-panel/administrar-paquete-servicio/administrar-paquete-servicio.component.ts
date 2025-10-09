import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { PaqueteServicioService } from 'src/app/control-panel/administrar-paquete-servicio/service/paquete-servicio.service';
import { EventoServicioService } from 'src/app/control-panel/administrar-paquete-servicio/service/evento-servicio.service';
import { EventoAllServiciosService } from 'src/app/control-panel/administrar-paquete-servicio/service/detalle-servicios.service';
import { DetalleServiciosComponent } from './components/detalle-servicios/detalle-servicios.component';
import { MatDialog } from '@angular/material/dialog';
import { AddEventoComponent } from 'src/app/components/add-evento/add-evento.component';
//C:\tesis\frontend-backup\src\app\components\add-evento\add-evento.component.ts

@Component({
  selector: 'app-administrar-paquete-servicio',
  templateUrl: './administrar-paquete-servicio.component.html',
  styleUrls: ['./administrar-paquete-servicio.component.css']
})
export class AdministrarPaqueteServicioComponent implements OnInit {

  base: boolean = true;
  servicioId: number = 0;
  servicioNombre: string = '';
  paquete: any[] = [];
  servicio: any[] = [];
  serviciosf: any[] = [];
  tempDialog: boolean = false;

  columnsToDisplay = ['ID', 'nombre', 'enlace'];

  constructor(
    private service: PaqueteServicioService,
    private service2: EventoServicioService,
    public dialog: MatDialog,
    private allserivicios: EventoAllServiciosService,
    private cdRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.getPaquete();
    this.getServicio();
    this.getAllService();
  }

  getPaquete() {
    this.service.getAllNombres().subscribe((response) => {
      this.paquete = response;
    });
  }

  getServicio() {
    this.service2.getAllNombres2().subscribe((response) => {
      this.servicio = response;
    });
  }

  openDialog() {
    const dialogPaq = this.dialog.open(DetalleServiciosComponent, { data: this.servicioId });
    dialogPaq.afterClosed().subscribe(() => {
      this.tempDialog = true;
      this.cdRef.detectChanges();
    });
  }

  getAllService() {
    this.allserivicios.getAllServicios().subscribe((response) => {
      this.serviciosf = response;
    });
  }

  prueba(event: number) {
    this.base = false;
    this.servicioId = event;
    this.servicioNombre = event.toString();
  }

  // ⬇️ agrega este import (ajusta la ruta si tu carpeta cambia)\
  // ...dentro de la clase
  openCreateDialog(): void {
    const dlg = this.dialog.open(AddEventoComponent, { width: '420px' });
    dlg.afterClosed().subscribe((ok) => {
      if (ok) {
        this.getPaquete();        // refresca la lista
      }
    });
  }


  // 🔹 NUEVO: función para asignar imagen según el nombre del evento
  imagenDe(nombre: string): string {
    const slug = (nombre || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
      .replace(/\s+/g, '-')                             // espacios -> guion
      .replace(/[^a-z0-9\-]/g, '');                     // limpia caracteres raros
    return `assets/images/${slug}.jpg`;                 // ✅ usa /images/
  }


}