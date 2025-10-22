import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
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
