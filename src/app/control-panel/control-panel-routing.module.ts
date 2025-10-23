import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdministrarEquiposComponent } from './administrar-equipos/administrar-equipos.component';
import { AdministrarEquipos2Component } from './administrar-equipos-2/administrar-equipos-2.component';
import { ListarportipoComponent } from './administrar-equipos/listarportipo/listarportipo.component';
import { AdministrarPaqueteServicioComponent } from './administrar-paquete-servicio/administrar-paquete-servicio.component';
import { EditarServicioComponent } from './administrar-paquete-servicio/components/editar-servicio/editar-servicio.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ContratoComponent } from './generar-contrato/contrato/contrato.component';
import { GenerarContratoComponent } from './generar-contrato/generar-contrato.component';
import { GestionarEquiposComponent } from './gestionar-equipos/gestionar-equipos.component';
import { GestionarPedidoComponent } from './gestionar-pedido/gestionar-pedido.component';
import { GestionarPersonalComponent } from './gestionar-personal/gestionar-personal.component';
import { AgregarProyectoComponent } from './gestionar-proyecto/agregar-proyecto/agregar-proyecto.component';
import { GestionarProyectoComponent } from './gestionar-proyecto/listar-proyecto/gestionar-proyecto.component';
import { HomeComponent } from './home/home.component';
import { RegistrarPagoComponent } from './registrar-pago/registrar-pago.component';
import { DetallePedidoComponent } from './gestionar-pedido/detalle-pedido/detalle-pedido.component';
import { ActualizarPedidoComponent } from './gestionar-pedido/actualizar-pedido/actualizar-pedido.component';
import { AgregarPedidoComponent } from './gestionar-pedido/agregar-pedido/agregar-pedido.component';
import { GestionarClienteComponent } from './gestionar-cliente/gestionar-cliente.component';
import { GestionarPerfilesComponent } from './gestionar-perfiles/gestionar-perfiles.component';
import { RegistrarPerfilComponent } from './gestionar-perfiles/registrar-perfil/registrar-perfil.component';
import { EditarPerfilComponent } from './gestionar-perfiles/editar-perfil/editar-perfil.component';
import { GestionarCotizacionesComponent } from './gestionar-cotizaciones/gestionar-cotizaciones.component';
import { RegistrarCotizacionComponent } from './gestionar-cotizaciones/registrar-cotizacion/registrar-cotizacion.component';
import { EditarCotizacionComponent } from './gestionar-cotizaciones/editar-cotizacion/editar-cotizacion.component';

const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'gestionar-equipos', component: GestionarEquiposComponent },
      { path: 'gestionar-equipos/listarportipo', component: ListarportipoComponent },
      { path: 'gestionar-proyecto', component: GestionarProyectoComponent },
      { path: 'gestionar-proyecto/agregar-proyecto', component: AgregarProyectoComponent },
      { path: 'administrar-equipos', component: AdministrarEquiposComponent },
      { path: 'administrar-equipos-2', component: AdministrarEquipos2Component },
      { path: 'administrar-paquete-servicio', component: AdministrarPaqueteServicioComponent },
      { path: 'administrar-paquete-servicio/editar-servicio', component: EditarServicioComponent },
      { path: 'gestionar-pedido', component: GestionarPedidoComponent },
      { path: 'gestionar-pedido/agregar', component: AgregarPedidoComponent },
      { path: 'gestionar-pedido/actualizar/:id', component: ActualizarPedidoComponent },
      { path: 'gestionar-pedido/detalle/:id', component: DetallePedidoComponent },
      { path: 'gestionar-personal', component: GestionarPersonalComponent },
      { path: 'registrar-pago', component: RegistrarPagoComponent },
      { path: 'generar-contrato', component: GenerarContratoComponent },
      { path: 'generar-contrato/contrato', component: ContratoComponent },
      { path: 'gestionar-cliente', component: GestionarClienteComponent },
      { path: 'gestionar-perfiles', component: GestionarPerfilesComponent },
      { path: 'gestionar-perfiles/registrar-perfil', component: RegistrarPerfilComponent },
      { path: 'gestionar-perfiles/editar-perfil', component: EditarPerfilComponent },
      { path: 'gestionar-cotizaciones', component: GestionarCotizacionesComponent },
      { path: 'gestionar-cotizaciones/registrar', component: RegistrarCotizacionComponent },
      { path: 'gestionar-cotizaciones/editar/:id', component: EditarCotizacionComponent },
      { path: '**', redirectTo: 'dashboard' },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ControlPanelRoutingModule { }
