import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdministrarEquiposComponent } from './administrar-equipos/administrar-equipos.component';
import { DetalleEquiposComponent } from './administrar-equipos/detalle-equipos/detalle-equipos.component';
import { EquipoDetalleComponent } from './administrar-equipos/equipo-detalle/equipo-detalle.component';
import { AdministrarPaqueteServicioComponent } from './administrar-paquete-servicio/administrar-paquete-servicio.component';
import { DetallePaqueteServicioComponent } from './administrar-paquete-servicio/detalle-paquete-servicio/detalle-paquete-servicio.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { GestionarPedidoComponent } from './gestionar-pedido/gestionar-pedido.component';
import { GestionarPersonalComponent } from './gestionar-personal/gestionar-personal.component';
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
import { GestionarProyectoComponent } from './gestionar-proyecto/gestionar-proyecto.component';

const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'administrar-equipos', component: AdministrarEquiposComponent },
      { path: 'administrar-equipos/detalle', component: DetalleEquiposComponent },
      { path: 'administrar-equipos/equipos', component: EquipoDetalleComponent },
      { path: 'administrar-paquete-servicio', component: AdministrarPaqueteServicioComponent },
      { path: 'administrar-paquete-servicio/:eventoId', component: DetallePaqueteServicioComponent },
      { path: 'administrar-paquete-servicio-2', pathMatch: 'full', redirectTo: 'administrar-paquete-servicio' },
      { path: 'gestionar-pedido', component: GestionarPedidoComponent },
      { path: 'gestionar-pedido/agregar', component: AgregarPedidoComponent },
      { path: 'gestionar-pedido/actualizar/:id', component: ActualizarPedidoComponent },
      { path: 'gestionar-pedido/detalle/:id', component: DetallePedidoComponent },
      { path: 'gestionar-personal', component: GestionarPersonalComponent },
      { path: 'registrar-pago', component: RegistrarPagoComponent },
      { path: 'gestionar-cliente', component: GestionarClienteComponent },
      { path: 'gestionar-perfiles', component: GestionarPerfilesComponent },
      { path: 'gestionar-perfiles/registrar-perfil', component: RegistrarPerfilComponent },
      { path: 'gestionar-perfiles/editar-perfil', component: EditarPerfilComponent },
      { path: 'gestionar-cotizaciones', component: GestionarCotizacionesComponent },
      { path: 'gestionar-cotizaciones/registrar', component: RegistrarCotizacionComponent },
      { path: 'gestionar-cotizaciones/editar/:id', component: EditarCotizacionComponent },
      { path: 'gestionar-proyecto', component: GestionarProyectoComponent },
      { path: '**', redirectTo: 'dashboard' },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ControlPanelRoutingModule { }
