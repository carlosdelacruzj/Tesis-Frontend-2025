import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { NgxChartsModule } from '@swimlane/ngx-charts';
import { ControlPanelRoutingModule } from './control-panel-routing.module';
import { AngularMaterialModule } from '../shared/angular-material/angular-material.module';
import { CellTemplateDirective, TableBaseComponent } from '../components/table/table-base.component';
import { TableBaseMejoraComponent } from '../components/table-base-mejora/table-base-mejora.component';
import { ModalBaseComponent } from '../components/modal-base/modal-base.component';
import { HomeComponent } from './home/home.component';
import { FooterComponent } from '../shared/footer/footer.component';
import { HeaderComponent } from '../shared/header/header.component';
import { SidebarComponent } from '../shared/sidebar/sidebar.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { GestionarEquiposComponent } from './gestionar-equipos/gestionar-equipos.component';
import { GestionarProyectoComponent } from './gestionar-proyecto/listar-proyecto/gestionar-proyecto.component';
import { AgregarProyectoComponent } from './gestionar-proyecto/agregar-proyecto/agregar-proyecto.component';
import { AdministrarPaqueteServicioComponent } from './administrar-paquete-servicio/administrar-paquete-servicio.component';
import { EventCardComponent } from './administrar-paquete-servicio/components/event-card/event-card.component';
import { EventServiceComponent } from './administrar-paquete-servicio/components/event-service/event-service.component';
import { DetalleServiciosComponent } from './administrar-paquete-servicio/components/detalle-servicios/detalle-servicios.component';
import { EditarServicioComponent } from './administrar-paquete-servicio/components/editar-servicio/editar-servicio.component';
import { AddEventoComponent } from '../components/add-evento/add-evento.component';
import { GestionarPedidoComponent } from './gestionar-pedido/gestionar-pedido.component';
import { AgregarPedidoComponent } from './gestionar-pedido/agregar-pedido/agregar-pedido.component';
import { ActualizarPedidoComponent } from './gestionar-pedido/actualizar-pedido/actualizar-pedido.component';
import { DetallePedidoComponent } from './gestionar-pedido/detalle-pedido/detalle-pedido.component';
import { ActualizarProyectoComponent } from './gestionar-proyecto/actualizar-proyecto/actualizar-proyecto.component';
import { AdministrarEquiposComponent } from './administrar-equipos/administrar-equipos.component';
import { AdministrarEquipos2Component } from './administrar-equipos-2/administrar-equipos-2.component';
import { ListarportipoComponent } from './administrar-equipos/listarportipo/listarportipo.component';
import { DetallesAlquiladoComponent } from './administrar-equipos/detalles-alquilado/detalles-alquilado.component';
import { GestionarPersonalComponent } from './gestionar-personal/gestionar-personal.component';
import { RegistrarPagoComponent } from './registrar-pago/registrar-pago.component';
import { GenerarContratoComponent } from './generar-contrato/generar-contrato.component';
import { ContratoComponent } from './generar-contrato/contrato/contrato.component';
import { ReportesEstadisticosComponent } from './reportes-estadisticos/reportes-estadisticos.component';
import { GestionarClienteComponent } from './gestionar-cliente/gestionar-cliente.component';
import { GestionarPerfilesComponent } from './gestionar-perfiles/gestionar-perfiles.component';
import { RegistrarPerfilComponent } from './gestionar-perfiles/registrar-perfil/registrar-perfil.component';
import { EditarPerfilComponent } from './gestionar-perfiles/editar-perfil/editar-perfil.component';
import { GestionarCotizacionesComponent } from './gestionar-cotizaciones/gestionar-cotizaciones.component';
import { RegistrarCotizacionComponent } from './gestionar-cotizaciones/registrar-cotizacion/registrar-cotizacion.component';
import { EditarCotizacionComponent } from './gestionar-cotizaciones/editar-cotizacion/editar-cotizacion.component';

@NgModule({
  declarations: [
    HomeComponent,
    FooterComponent,
    HeaderComponent,
    SidebarComponent,
    DashboardComponent,
    GestionarEquiposComponent,
    AdministrarEquiposComponent,
    AdministrarEquipos2Component,
    ListarportipoComponent,
    DetallesAlquiladoComponent,
    GestionarProyectoComponent,
    AgregarProyectoComponent,
    ActualizarProyectoComponent,
    GestionarPedidoComponent,
    AgregarPedidoComponent,
    ActualizarPedidoComponent,
    DetallePedidoComponent,
    AdministrarPaqueteServicioComponent,
    EventCardComponent,
    EventServiceComponent,
    DetalleServiciosComponent,
    EditarServicioComponent,
    AddEventoComponent,
    GestionarPersonalComponent,
    RegistrarPagoComponent,
    GenerarContratoComponent,
    ContratoComponent,
    ReportesEstadisticosComponent,
    GestionarClienteComponent,
    GestionarPerfilesComponent,
    RegistrarPerfilComponent,
    EditarPerfilComponent,
    GestionarCotizacionesComponent,
    RegistrarCotizacionComponent,
    EditarCotizacionComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ControlPanelRoutingModule,
    AngularMaterialModule,
    NgxChartsModule,
    DragDropModule,
    NgbModule,
    TableBaseComponent,
    CellTemplateDirective,
    TableBaseMejoraComponent,
    ModalBaseComponent
  ]
})
export class ControlPanelModule { }
