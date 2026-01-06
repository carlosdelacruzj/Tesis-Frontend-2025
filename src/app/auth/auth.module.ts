import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthRoutingModule } from './auth-routing.module';
import { LoginComponent } from './pages/login/login.component';
import { RegistroComponent } from './pages/registro/registro.component';
import { MainComponent } from './pages/main/main.component';
import { AngularMaterialModule } from '../shared/angular-material/angular-material.module';
import { RecuperarContrasenaComponent } from './pages/recuperar-contrasena/recuperar-contrasena.component';
import { NuevaCContrasenaComponent } from './pages/nueva-ccontrasena/nueva-ccontrasena.component';

@NgModule({
  declarations: [
    LoginComponent,
    RegistroComponent,
    MainComponent,
    RecuperarContrasenaComponent,
    NuevaCContrasenaComponent
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    ReactiveFormsModule,
    AngularMaterialModule
  ]
})
export class AuthModule { }
