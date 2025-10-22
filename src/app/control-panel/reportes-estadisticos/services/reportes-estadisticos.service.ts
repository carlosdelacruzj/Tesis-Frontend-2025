import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Equipos,
  Evento,
  Proyecto,
  Estados,Ganancia,
} from '../models/reportes-estadisticos.model';

@Injectable({
  providedIn: 'root',
})
export class ReportesEstadisticos {
  constructor(private http: HttpClient) {}

  private EQUIPOS =
    'https://tp2021database.herokuapp.com/dashboard/consulta/getReporteListaEquipo';

  private PROYECTOS =
    'https://tp2021database.herokuapp.com/dashboard/consulta/getReporteProyectosXMes';

  private SERVICIOS =
    'https://tp2021database.herokuapp.com/dashboard/consulta/getReportEventosContado';

  private ESTADOS_PROYECTOS =
    'https://tp2021database.herokuapp.com/dashboard/consulta/getReporteEstadoProyectos';

  private GANACIAS = 'https://tp2021database.herokuapp.com/dashboard/consulta/getReporteGanancias'

  public getEquipos(): Observable<Equipos[]> {
    return this.http.get<Equipos[]>(this.EQUIPOS);
  }
  public getProyectos(): Observable<Proyecto[]> {
    return this.http.get<Proyecto[]>(this.PROYECTOS);
  }

  public getEventos(): Observable<Evento[]> {
    return this.http.get<Evento[]>(this.SERVICIOS);
  }

  public getEstados(): Observable<Estados> {
    return this.http.get<Estados>(this.ESTADOS_PROYECTOS);
  }

  public getGanancias(): Observable<Ganancia>{
    return this.http.get<Ganancia>(this.GANACIAS)
  }
}
