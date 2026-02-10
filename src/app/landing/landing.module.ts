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
import { LandingPortfolioComponent } from './portfolio/landing-portfolio.component';
import { UsdPipe } from '../pipes/usd.pipe';
import { EstadoBadgeComponent } from '../components/estado-badge/estado-badge.component';

@NgModule({
  declarations: [
    LandingComponent,
    LandingLayoutComponent,
    LandingHeaderComponent,
    LandingPortfolioComponent,
    LandingClientCotizacionesComponent,
    LandingClientPedidosComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AngularMaterialModule,
    UsdPipe,
    EstadoBadgeComponent,
    LandingRoutingModule
  ]
})
export class LandingModule {}
