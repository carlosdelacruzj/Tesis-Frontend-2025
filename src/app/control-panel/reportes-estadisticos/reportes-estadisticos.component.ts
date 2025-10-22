import { Component, OnInit } from '@angular/core';
import { ReportesEstadisticos } from './services/reportes-estadisticos.service';
import { Equipos, Proyecto } from './models/reportes-estadisticos.model';

@Component({
  selector: 'app-reportes-estadisticos',
  templateUrl: './reportes-estadisticos.component.html',
  styleUrls: ['./reportes-estadisticos.component.css'],
})
export class ReportesEstadisticosComponent implements OnInit {
  ngOnInit(): void {
    this.obtenerEquipos();
    this.obtenerProyectos();
    this.obtenerServicios();
    this.obtenerEstados();
    this.obtenerGanacias();
  }

  equipos: Equipos[] = [];

  single: any[] = [];
  single2: any[] = [];
  view: any[] = [200, 200];

  proyectosReady: boolean = false;
  serviciosReady: boolean = false;
  estadosReady: boolean = false;
  gananciasReady: boolean = false;

  single4: any[] = [];
  Ganancias: boolean = false;

  proyectos: Proyecto = {} as Proyecto;

  data: any[] = [];
  dataServicios: any[] = [];
  dataEstados: any[] = [];
  dataGanancias: any[] = [];

  // options
  gradient: boolean = true;
  showLegend: boolean = false;
  showLabels: boolean = true;
  isDoughnut: boolean = false;
  legendPosition: string = 'below';

  colorScheme = {
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA'],
  };

  showXAxis = true;
  showYAxis = true;
  gradient2 = false;
  showLegend2 = true;
  showXAxisLabel = true;
  xAxisLabel = 'Cantidad';
  showYAxisLabel = true;
  yAxisLabel = 'Mes';

  constructor(private service: ReportesEstadisticos) {}

  obtenerEquipos() {
    this.service.getEquipos().subscribe((res) => {
      this.equipos = res;
    });
  }

  obtenerServicios() {
    this.service.getEventos().subscribe((res) => {
      const values = Object.values(res);
      for (let i = 0; i < values.length; i++) {
        var obj = {
          name: `${values[i].servicio} - ${values[i].evento} - ${values[i].nombre}`,
          value: values[i].cantidad,
        };
        this.dataServicios.push(obj);
      }
      this.serviciosReady = true;
    });
  }

  obtenerProyectos() {
    this.service.getProyectos().subscribe((res) => {
      const values = Object.values(res[0]);
      for (let i = 0; i < values.length; i++) {
        var obj = {
          name: 'mes' + (i + 1).toString(),
          value: values[i],
        };
        this.data.push(obj);
      }
      this.proyectosReady = true;
    });
  }

  obtenerEstados() {
    this.service.getEstados().subscribe((res) => {
      const values = Object.values(res);
      const keys = Object.keys(values[0]);
      for (let i = 0; i < keys.length; i++) {
        var obj = {
          name: keys[i],
          value: values[0][keys[i]],
        };
        this.dataEstados.push(obj);
      }
      this.estadosReady = true;
    });
  }

  obtenerGanacias() {
    this.service.getGanancias().subscribe((res) => {
      const values = Object.values(res);
      const keys = Object.keys(values[0]);
      for (let i = 0; i < keys.length; i++) {
        var obj = {
          name: keys[i],
          value: values[0][keys[i]] == null ? 0 : values[0][keys[i]],
        };
        this.dataGanancias.push(obj);
      }
      console.log(this.dataGanancias);
      this.gananciasReady = true;
    });
  }

  showGanancias() {
    this.Ganancias = true;
  }
  showProyectos() {
    this.Ganancias = false;
  }
}
