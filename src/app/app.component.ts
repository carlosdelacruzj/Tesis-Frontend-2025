import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  // mantenemos el inline template para evitar el "1"
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {}
