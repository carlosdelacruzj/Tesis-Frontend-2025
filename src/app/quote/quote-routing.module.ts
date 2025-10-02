import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuoteRequestComponent } from './quote-request/quote-request.component';

const routes: Routes = [
  { path: '', component: QuoteRequestComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class QuoteRoutingModule {}
