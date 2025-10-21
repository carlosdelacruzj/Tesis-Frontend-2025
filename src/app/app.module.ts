import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgxChartsModule } from '@swimlane/ngx-charts';

import { AppComponent } from './app.component';
import { GestionarEquiposComponent } from './control-panel/gestionar-equipos/gestionar-equipos.component';
import { DashboardComponent } from './control-panel/dashboard/dashboard.component';
import { AppRoutingModule } from './app-routing.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AngularMaterialModule } from './shared/angular-material/angular-material.module';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { getSpanishPaginatorIntl } from './shared/angular-material/spanish-paginator-intl';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

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
import { ListarportipoComponent } from './control-panel/administrar-equipos/listarportipo/listarportipo.component';
import { DetallesAlquiladoComponent } from './control-panel/administrar-equipos/detalles-alquilado/detalles-alquilado.component';
import { RegistrarPagoComponent } from './control-panel/registrar-pago/registrar-pago.component';
import { ContratoComponent } from './control-panel/generar-contrato/contrato/contrato.component';
import { AgregarPedidoComponent } from './control-panel/gestionar-pedido/agregar-pedido/agregar-pedido.component';
import { DetallePedidoComponent } from './control-panel/gestionar-pedido/detalle-pedido/detalle-pedido.component';
import { ActualizarPedidoComponent } from './control-panel/gestionar-pedido/actualizar-pedido/actualizar-pedido.component';
import { ReportesEstadisticosComponent } from './control-panel/reportes-estadisticos/reportes-estadisticos.component';
import { GestionarClienteComponent } from './control-panel/gestionar-cliente/gestionar-cliente.component';
import { GestionarPerfilesComponent } from './control-panel/gestionar-perfiles/gestionar-perfiles.component';
import { RegistrarPerfilComponent } from './control-panel/gestionar-perfiles/registrar-perfil/registrar-perfil.component';
import { EditarPerfilComponent } from './control-panel/gestionar-perfiles/editar-perfil/editar-perfil.component';
import { VerCalendarioComponent } from './control-panel/ver-calendario/ver-calendario.component';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { DialogComponent } from './control-panel/ver-calendario/dialog/dialog.component';
import { LandingComponent } from './landing/landing.component';
import { GestionarCotizacionesComponent } from './control-panel/gestionar-cotizaciones/gestionar-cotizaciones.component';
import { RegistrarCotizacionComponent } from './control-panel/gestionar-cotizaciones/registrar-cotizacion/registrar-cotizacion.component';
import { EditarCotizacionComponent } from './control-panel/gestionar-cotizaciones/editar-cotizacion/editar-cotizacion.component';
import { AgendaOperativaComponent } from './control-panel/agenda-operativa/agenda-operativa.component';
import { CellTemplateDirective, TableBaseComponent } from './components/table/table-base.component';
import { TableBaseMejoraComponent } from './components/table-base-mejora/table-base-mejora.component';
import { ModalBaseComponent } from './components/modal-base/modal-base.component';

// ⬇️ IMPORTA TU DIALOG AQUÍ
import { AddEventoComponent } from 'src/app/components/add-evento/add-evento.component';

@NgModule({
    declarations: [
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
        ListarportipoComponent,
        RegistrarPagoComponent,
        GenerarContratoComponent,
        ContratoComponent,
        AgregarPedidoComponent,
        DetallePedidoComponent,
        ActualizarPedidoComponent,
        ReportesEstadisticosComponent,
        GestionarClienteComponent,
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
        AgendaOperativaComponent,
        AddEventoComponent,
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
        CellTemplateDirective,
        TableBaseComponent,
        TableBaseMejoraComponent,
        ModalBaseComponent,
        FullCalendarModule], providers: [
            { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() },
            DatePipe,
            provideHttpClient(withInterceptorsFromDi())
        ]
})
export class AppModule {}
