import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ValidarTokenGuard } from './guards/validar-token.guard';
const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./landing/landing.module').then(m => m.LandingModule)
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule)
  },
  {
    path: 'home',
    loadChildren: () => import('./control-panel/control-panel.module').then(m => m.ControlPanelModule),
    canActivate: [ValidarTokenGuard],
    canLoad: [ValidarTokenGuard],
  },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
