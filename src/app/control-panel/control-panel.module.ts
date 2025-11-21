import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { ControlPanelRoutingModule } from './control-panel-routing.module';
import { AngularMaterialModule } from '../shared/angular-material/angular-material.module';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CellTemplateDirective, TableBaseComponent } from '../components/table-base/table-base.component';
import { ListToolbarComponent } from '../components/list-toolbar/list-toolbar.component';
import { ModalBaseComponent } from '../components/modal-base/modal-base.component';
import { FormularioBaseComponent } from '../components/formulario-base/formulario-base.component';
import { HomeComponent } from './home/home.component';
import { FooterComponent } from '../shared/footer/footer.component';
import { HeaderComponent } from '../shared/header/header.component';
import { SidebarComponent } from '../shared/sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { GestionarEquiposComponent } from './gestionar-equipos/gestionar-equipos.component';
import { AdministrarPaqueteServicioComponent } from './administrar-paquete-servicio/administrar-paquete-servicio.component';
import { EventCardComponent } from './administrar-paquete-servicio/components/event-card/event-card.component';
import { DetallePaqueteServicioComponent } from './administrar-paquete-servicio/detalle-paquete-servicio/detalle-paquete-servicio.component';
import { AddEventoComponent } from '../components/add-evento/add-evento.component';
import { GestionarPedidoComponent } from './gestionar-pedido/gestionar-pedido.component';
import { AgregarPedidoComponent } from './gestionar-pedido/agregar-pedido/agregar-pedido.component';
import { ActualizarPedidoComponent } from './gestionar-pedido/actualizar-pedido/actualizar-pedido.component';
import { DetallePedidoComponent } from './gestionar-pedido/detalle-pedido/detalle-pedido.component';
import { AdministrarEquiposComponent } from './administrar-equipos/administrar-equipos.component';
import { DetalleEquiposComponent } from './administrar-equipos/detalle-equipos/detalle-equipos.component';
import { EquipoDetalleComponent } from './administrar-equipos/equipo-detalle/equipo-detalle.component';
import { GestionarPersonalComponent } from './gestionar-personal/gestionar-personal.component';
import { RegistrarPagoComponent } from './registrar-pago/registrar-pago.component';
import { GenerarContratoComponent } from './generar-contrato/generar-contrato.component';
import { ContratoComponent } from './generar-contrato/contrato/contrato.component';
import { GestionarClienteComponent } from './gestionar-cliente/gestionar-cliente.component';
import { GestionarPerfilesComponent } from './gestionar-perfiles/gestionar-perfiles.component';
import { RegistrarPerfilComponent } from './gestionar-perfiles/registrar-perfil/registrar-perfil.component';
import { EditarPerfilComponent } from './gestionar-perfiles/editar-perfil/editar-perfil.component';
import { GestionarCotizacionesComponent } from './gestionar-cotizaciones/gestionar-cotizaciones.component';
import { RegistrarCotizacionComponent } from './gestionar-cotizaciones/registrar-cotizacion/registrar-cotizacion.component';
import { EditarCotizacionComponent } from './gestionar-cotizaciones/editar-cotizacion/editar-cotizacion.component';
import { GestionarProyectoComponent } from './gestionar-proyecto/gestionar-proyecto.component';

@NgModule({
  declarations: [
    HomeComponent,
    FooterComponent,
    HeaderComponent,
    SidebarComponent,
    DashboardComponent,
    GestionarEquiposComponent,
    AdministrarEquiposComponent,
    DetalleEquiposComponent,
    EquipoDetalleComponent,
    GestionarPedidoComponent,
    AgregarPedidoComponent,
    ActualizarPedidoComponent,
    DetallePedidoComponent,
    AdministrarPaqueteServicioComponent,
    EventCardComponent,
    DetallePaqueteServicioComponent,
    AddEventoComponent,
    GestionarPersonalComponent,
    RegistrarPagoComponent,
    GenerarContratoComponent,
    ContratoComponent,
    GestionarClienteComponent,
    GestionarPerfilesComponent,
    RegistrarPerfilComponent,
    EditarPerfilComponent,
    GestionarCotizacionesComponent,
    RegistrarCotizacionComponent,
    EditarCotizacionComponent,
    GestionarProyectoComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ControlPanelRoutingModule,
    AngularMaterialModule,
    MatSelectModule,
    MatOptionModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    DragDropModule,
    NgbModule,
    TableBaseComponent,
    CellTemplateDirective,
    ListToolbarComponent,
    ModalBaseComponent,
    FormularioBaseComponent
  ]
})
export class ControlPanelModule { }
