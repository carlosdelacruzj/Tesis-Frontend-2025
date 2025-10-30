import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LandingComponent } from './landing.component';
import { LandingLayoutComponent } from './layout/landing-layout.component';
import { LandingClientCotizacionesComponent } from './portal/landing-client-cotizaciones.component';
import { LandingClientPedidosComponent } from './portal/landing-client-pedidos.component';

const routes: Routes = [
  {
    path: '',
    component: LandingLayoutComponent,
    children: [
      { path: '', component: LandingComponent },
      { path: 'inicio', redirectTo: '', pathMatch: 'full' },
      { path: 'cotizaciones', component: LandingClientCotizacionesComponent },
      { path: 'pedidos', component: LandingClientPedidosComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LandingRoutingModule {}
