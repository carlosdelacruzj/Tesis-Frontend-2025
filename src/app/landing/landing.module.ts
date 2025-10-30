import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AngularMaterialModule } from '../shared/angular-material/angular-material.module';
import { LandingComponent } from './landing.component';
import { LandingRoutingModule } from './landing-routing.module';
import { LandingLayoutComponent } from './layout/landing-layout.component';
import { LandingHeaderComponent } from './components/landing-header/landing-header.component';
import { LandingClientCotizacionesComponent } from './portal/landing-client-cotizaciones.component';
import { LandingClientPedidosComponent } from './portal/landing-client-pedidos.component';

@NgModule({
  declarations: [
    LandingComponent,
    LandingLayoutComponent,
    LandingHeaderComponent,
    LandingClientCotizacionesComponent,
    LandingClientPedidosComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AngularMaterialModule,
    LandingRoutingModule
  ]
})
export class LandingModule {}
