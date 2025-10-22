import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Proyecto,
  Empleado,
  EquiposByProyecto,
  AsignarEquipos,
} from '../model/gestionar-equipos.model';

@Injectable({
  providedIn: 'root',
})
export class GestionarEquipos {
  selectProyecto: Proyecto = {
    PK_Pro_Cod: 0,
    Pro_Nombre: '',
    FK_P_Cod: 0,
    EPro_Fecha_Inicio_Edicion: '',
    Pro_Fecha_Fin_Edicion: '',
    Pro_Revision_Edicion: 0,
    Pro_Revision_Multimedia: 0,
    Pro_Enlace: '',
  };

  selectEmpleado: Empleado = {
    ID: 0,
    Nombre: '',
    Apellido: '',
    Car_Nombre: '',
  };

  selectEquiposByProyecto: EquiposByProyecto = {
    ID: 0,
    ID_Empleado: 0,
    Empleado: '',
    CodigoEquipo: '',
    TipoEquipo: '',
    NombreEquipo: '',
  };

  postAsignarEquipos: AsignarEquipos = {
    proyecto: 0,
    empleado: 0,
    equipos: '',
  };

   fecha2= "";
  private PROYECTOS_ASIGNAR =
    'https://tp2021database.herokuapp.com/proyecto/consulta/getAllAsignarEquipos';

  private PROYECT_ID =
    'https://tp2021database.herokuapp.com/proyecto/consulta/getByIdProyecto/';

  private EMPLEADOS =
    'https://tp2021database.herokuapp.com/empleado/consulta/getAllEmpleados';

  private TIPOS_EQUIPO =
    'https://tp2021database.herokuapp.com/equipo/consulta/getAllTipoEquipo';

  private EQUIPO_ID =
    'https://tp2021database.herokuapp.com/proyecto/consulta/getAllEquiposFiltrados/';

  private EQUIPOS_BY_PROYECTO =
    'https://tp2021database.herokuapp.com/proyecto/consulta/getAsignarEquiposById/';

  private ASIGNAR_EQUIPOS =
    'https://tp2021database.herokuapp.com/proyecto/registro/postAsignarPersonalEquipo';
  private ELIMINAR_EQUIPOS =
    'https://tp2021database.herokuapp.com/proyecto/delete/deleteAsignarEquipoById/';

  constructor(private http: HttpClient) {}

  public getAll(): Observable<any> {
    return this.http.get(this.PROYECTOS_ASIGNAR);
  }

  public getById(id: number): Observable<any> {
    return this.http.get(this.PROYECT_ID + `${id}`);
  }

  public getEmpleados(): Observable<any> {
    return this.http.get(this.EMPLEADOS);
  }

  public getTiposEquipo(): Observable<any> {
    return this.http.get(this.TIPOS_EQUIPO);
  }

  public getEquipoId(
    fecha: string,
    proyecto: number,
    id: number
  ): Observable<any> {

    return this.http.get(
      this.EQUIPO_ID + `${fecha}` + '/' + `${proyecto}` + '/' + `${id}`
    );
  }

  public getEquiposByProyecto(id: number): Observable<any> {
    return this.http.get(this.EQUIPOS_BY_PROYECTO + `${id}`);
  }

  public deleteAsignacion(id: number): Observable<void> {
    return this.http.delete<void>(this.ELIMINAR_EQUIPOS + id);
  }

  public postEquiposProyectos(
    proyecto: number,
    empleado: number,
    equipos: string
  ) {
    return this.http.post(this.ASIGNAR_EQUIPOS, {
      proyecto: proyecto,
      empleado: empleado,
      equipos: equipos,
    });
  }
}
