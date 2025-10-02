import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { QuoteRoutingModule } from './quote-routing.module';
import { QuoteRequestComponent } from './quote-request/quote-request.component';
import { AngularMaterialModule } from '../shared/angular-material/angular-material.module';

@NgModule({
  declarations: [QuoteRequestComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AngularMaterialModule,
    QuoteRoutingModule
  ]
})
export class QuoteModule {}
