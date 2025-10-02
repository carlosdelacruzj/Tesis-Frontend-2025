import { NgModule, Component } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DashboardComponent } from './control-panel/dashboard/dashboard.component';
import { GestionarEquiposComponent } from './control-panel/gestionar-equipos/gestionar-equipos.component';
import { GestionarProyectoComponent } from './control-panel/gestionar-proyecto/listar-proyecto/gestionar-proyecto.component';
import { AgregarProyectoComponent } from './control-panel/gestionar-proyecto/agregar-proyecto/agregar-proyecto.component';
import { GestionarPedidoComponent } from './control-panel/gestionar-pedido/gestionar-pedido.component';
import { RegistrarPagoComponent } from './control-panel/registrar-pago/registrar-pago.component';
import { ReportesEstadisticosComponent } from './control-panel/reportes-estadisticos/reportes-estadisticos.component';

import { GenerarContratoComponent } from './control-panel/generar-contrato/generar-contrato.component';
import { ContratoComponent } from './control-panel/generar-contrato/contrato/contrato.component';
import { AdministrarPaqueteServicioComponent } from './control-panel/administrar-paquete-servicio/administrar-paquete-servicio.component';
import { DetalleServiciosComponent } from './control-panel/administrar-paquete-servicio/components/detalle-servicios/detalle-servicios.component';
import { EditarServicioComponent } from './control-panel/administrar-paquete-servicio/components/editar-servicio/editar-servicio.component';
import { AdministrarEquiposComponent } from './control-panel/administrar-equipos/administrar-equipos.component';
import { GestionarPersonalComponent } from './control-panel/gestionar-personal/gestionar-personal.component';
import { AgregarPersonalComponent } from './control-panel/gestionar-personal/agregar-personal/agregar-personal.component';
import { ListarportipoComponent } from './control-panel/administrar-equipos/listarportipo/listarportipo.component';
import { ValidarTokenGuard } from './guards/validar-token.guard';
import { VerCalendarioComponent } from './control-panel/ver-calendario/ver-calendario.component';
import { LandingComponent } from './landing/landing.component';
/* 
const routes: Routes = [
  {
    path: 'auth',
    loadChildren:() => import('./auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'home',loadChildren:() => import('./control-panel/control-panel.module').then(m => m.ControlPanelModule),
    /*canActivate:[ValidarTokenGuard],
    canLoad: [ValidarTokenGuard] 
  },
  {
    path: '**', redirectTo: 'auth'
  }
]; */
const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'inicio', component: LandingComponent },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'cotizar',
    loadChildren: () => import('./quote/quote.module').then(m => m.QuoteModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./control-panel/control-panel.module').then(m => m.ControlPanelModule),
    // canActivate: [ValidarTokenGuard],
    // canLoad: [ValidarTokenGuard],
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
