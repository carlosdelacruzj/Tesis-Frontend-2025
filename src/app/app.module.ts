import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { NgxChartsModule } from '@swimlane/ngx-charts';

import { AppComponent } from './app.component';
// import { HeaderComponent } from './shared/header/header.component';
// import { FooterComponent } from './shared/footer/footer.component';
// import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { GestionarEquiposComponent } from './control-panel/gestionar-equipos/gestionar-equipos.component';
import { DashboardComponent } from './control-panel/dashboard/dashboard.component';
import { AppRoutingModule } from './app-routing.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AngularMaterialModule } from './shared/angular-material/angular-material.module';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { getSpanishPaginatorIntl } from './shared/angular-material/spanish-paginator-intl';
import { ReactiveFormsModule } from '@angular/forms';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';


// import {
//   NgxMatDatetimePickerModule,
//   NgxMatNativeDateModule,
//   NgxMatTimepickerModule
// } from '@angular-material-components/datetime-picker';
import { GenerarContratoComponent } from './control-panel/generar-contrato/generar-contrato.component';
import { AdministrarPaqueteServicioComponent } from './control-panel/administrar-paquete-servicio/administrar-paquete-servicio.component';
import { EventCardComponent } from './control-panel/administrar-paquete-servicio/components/event-card/event-card.component';
import { EventServiceComponent } from './control-panel/administrar-paquete-servicio/components/event-service/event-service.component';
import { DetalleServiciosComponent } from './control-panel/administrar-paquete-servicio/components/detalle-servicios/detalle-servicios.component';
import { GestionarProyectoComponent } from './control-panel/gestionar-proyecto/listar-proyecto/gestionar-proyecto.component';
import { AgregarProyectoComponent } from './control-panel/gestionar-proyecto/agregar-proyecto/agregar-proyecto.component';
import { GestionarPedidoComponent } from './control-panel/gestionar-pedido/gestionar-pedido.component';
import { ActualizarProyectoComponent } from './control-panel/gestionar-proyecto/actualizar-proyecto/actualizar-proyecto.component';
import { DatePipe } from '@angular/common';
import { EditarServicioComponent } from './control-panel/administrar-paquete-servicio/components/editar-servicio/editar-servicio.component';
import { AdministrarEquiposComponent } from './control-panel/administrar-equipos/administrar-equipos.component';
import { GestionarPersonalComponent } from './control-panel/gestionar-personal/gestionar-personal.component';
import { AgregarPersonalComponent } from './control-panel/gestionar-personal/agregar-personal/agregar-personal.component';
import { ListarportipoComponent } from './control-panel/administrar-equipos/listarportipo/listarportipo.component';
import { DetallesAlquiladoComponent } from './control-panel/administrar-equipos/detalles-alquilado/detalles-alquilado.component';

import { RegistrarPagoComponent } from './control-panel/registrar-pago/registrar-pago.component';
import { ContratoComponent } from './control-panel/generar-contrato/contrato/contrato.component';
import { AgregarPedidoComponent } from './control-panel/gestionar-pedido/agregar-pedido/agregar-pedido.component';
import { DetallePedidoComponent } from './control-panel/gestionar-pedido/detalle-pedido/detalle-pedido.component';
import { ActualizarPedidoComponent } from './control-panel/gestionar-pedido/actualizar-pedido/actualizar-pedido.component';
import { ReportesEstadisticosComponent } from './control-panel/reportes-estadisticos/reportes-estadisticos.component';
import { GestionarClienteComponent } from './control-panel/gestionar-cliente/gestionar-cliente.component';
import { RegistrarClienteComponent } from './control-panel/gestionar-cliente/registrar-cliente/registrar-cliente.component';
import { EditarClienteComponent } from './control-panel/gestionar-cliente/editar-cliente/editar-cliente.component';
import { GestionarPerfilesComponent } from './control-panel/gestionar-perfiles/gestionar-perfiles.component';
import { RegistrarPerfilComponent } from './control-panel/gestionar-perfiles/registrar-perfil/registrar-perfil.component';
import { EditarPerfilComponent } from './control-panel/gestionar-perfiles/editar-perfil/editar-perfil.component';
import { VerCalendarioComponent } from './control-panel/ver-calendario/ver-calendario.component';
import { FullCalendarModule } from '@fullcalendar/angular'; // must go before plugins
import dayGridPlugin from '@fullcalendar/daygrid'; // a plugin!
import interactionPlugin  from '@fullcalendar/interaction';
import { DialogComponent } from './control-panel/ver-calendario/dialog/dialog.component'; // a plugin!
import { LandingComponent } from './landing/landing.component';
import { GestionarCotizacionesComponent } from './control-panel/gestionar-cotizaciones/gestionar-cotizaciones.component';
import { RegistrarCotizacionComponent } from './control-panel/gestionar-cotizaciones/registrar-cotizacion/registrar-cotizacion.component';
import { EditarCotizacionComponent } from './control-panel/gestionar-cotizaciones/editar-cotizacion/editar-cotizacion.component';



    // HeaderComponent,
    // FooterComponent,
    // SidebarComponent,
@NgModule({ declarations: [
        AppComponent,
        GestionarProyectoComponent,
        GestionarEquiposComponent,
        DashboardComponent,
        AgregarProyectoComponent,
        GestionarPedidoComponent,
        AdministrarPaqueteServicioComponent,
        EventCardComponent,
        EventServiceComponent,
        DetalleServiciosComponent,
        ActualizarProyectoComponent,
        EditarServicioComponent,
        AdministrarEquiposComponent,
        GestionarPersonalComponent,
        AgregarPersonalComponent,
        ListarportipoComponent,
        RegistrarPagoComponent,
        GenerarContratoComponent,
        ContratoComponent,
        AgregarPedidoComponent,
        DetallePedidoComponent,
        ActualizarPedidoComponent,
        ReportesEstadisticosComponent,
        GestionarClienteComponent,
        RegistrarClienteComponent,
        EditarClienteComponent,
        GestionarPerfilesComponent,
        RegistrarPerfilComponent,
        EditarPerfilComponent,
        DetallesAlquiladoComponent,
        VerCalendarioComponent,
        DialogComponent,
        LandingComponent,
        GestionarCotizacionesComponent,
        RegistrarCotizacionComponent,
        EditarCotizacionComponent,
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        FormsModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        AngularMaterialModule,
        // NgxMatDatetimePickerModule,
        // NgxMatTimepickerModule,
        // NgxMatNativeDateModule,
        ReactiveFormsModule,
        NgbModule,
        NgxChartsModule,
        FullCalendarModule], providers: [
        { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() },
        DatePipe,
        provideHttpClient(withInterceptorsFromDi())
    ] })
export class AppModule {}
