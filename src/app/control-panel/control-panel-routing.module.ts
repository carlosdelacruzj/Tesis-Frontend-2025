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
import { DetalleProyectoComponent } from './gestionar-proyecto/detalle-proyecto/detalle-proyecto.component';
import { PagosEstandarComponent } from './pagos-estandar/pagos-estandar.component';
import { RoleGuard } from '../guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'administrar-equipos', component: AdministrarEquiposComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'administrar-equipos/detalle', component: DetalleEquiposComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'administrar-equipos/equipos', component: EquipoDetalleComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'administrar-paquete-servicio', component: AdministrarPaqueteServicioComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'administrar-paquete-servicio/:eventoId', component: DetallePaqueteServicioComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'administrar-paquete-servicio-2', pathMatch: 'full', redirectTo: 'administrar-paquete-servicio' },
      { path: 'gestionar-pedido', component: GestionarPedidoComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-pedido/agregar', component: AgregarPedidoComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-pedido/actualizar/:id', component: ActualizarPedidoComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-pedido/detalle/:id', component: DetallePedidoComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-personal', component: GestionarPersonalComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'pagos-estandar', component: PagosEstandarComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-cliente', component: GestionarClienteComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-perfiles', component: GestionarPerfilesComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'gestionar-perfiles/registrar-perfil', component: RegistrarPerfilComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'gestionar-perfiles/editar-perfil', component: EditarPerfilComponent, canActivate: [RoleGuard], data: { roles: ['Admin'] } },
      { path: 'gestionar-cotizaciones', component: GestionarCotizacionesComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-cotizaciones/registrar', component: RegistrarCotizacionComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-cotizaciones/editar/:id', component: EditarCotizacionComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-proyecto', component: GestionarProyectoComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: 'gestionar-proyecto/:id', component: DetalleProyectoComponent, canActivate: [RoleGuard], data: { roles: ['Admin', 'Vendedor'] } },
      { path: '**', redirectTo: 'dashboard' },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ControlPanelRoutingModule { }
