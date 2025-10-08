import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NgxChartsModule } from '@swimlane/ngx-charts';
import { FullCalendarModule } from '@fullcalendar/angular';
import { ControlPanelRoutingModule } from './control-panel-routing.module';
import { HomeComponent } from './home/home.component';
import { FooterComponent } from '../shared/footer/footer.component';
import { HeaderComponent } from '../shared/header/header.component';
import { SidebarComponent } from '../shared/sidebar/sidebar.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TableBaseComponent } from '../components/table/table-base.component';

@NgModule({
  declarations: [
    HomeComponent,
    FooterComponent,
    HeaderComponent,
    SidebarComponent
  ],
  imports: [
    TableBaseComponent,
    CommonModule,
    ControlPanelRoutingModule,
    NgxChartsModule,
    FullCalendarModule,
    DragDropModule
  ]
})
export class ControlPanelModule { }
