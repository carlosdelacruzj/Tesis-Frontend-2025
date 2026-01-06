import { Component, OnInit, Type, inject } from '@angular/core';
import { Router, Routes, NavigationEnd, RouteConfigLoadStart, RouteConfigLoadEnd, GuardsCheckStart, GuardsCheckEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  // mantenemos el inline template para evitar el "1"
  template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    const tokenName = (token: unknown): string | undefined => {
      if (typeof token === 'function') {
        return token.name;
      }
      if (token && typeof token === 'object' && 'name' in token) {
        const nameValue = (token as { name?: unknown }).name;
        return typeof nameValue === 'string' ? nameValue : undefined;
      }
      return undefined;
    };

    // A) dump de TODA la config de rutas (incluye children y guards)
    const dump = (routes: Routes, prefix = '') => {
      routes.forEach(r => {
        const info = {
          path: r.path,
          redirectTo: r.redirectTo,
          pathMatch: r.pathMatch as string | undefined,
          component: (r.component as Type<unknown> | undefined)?.name, // solo nombre para log
          hasLoadChildren: !!r.loadChildren,
          canActivate: (r.canActivate || []).map(tokenName).filter((name): name is string => !!name),
          canLoad: (r.canLoad || []).map(tokenName).filter((name): name is string => !!name),
          canActivateChild: (r.canActivateChild || []).map(tokenName).filter((name): name is string => !!name),
          resolveKeys: r.resolve ? Object.keys(r.resolve) : [],
        };
        console.log(prefix + '🧭 Route ->', info);
        if (r.children) dump(r.children, prefix + '  ');
      });
    };
    console.log('==== ROUTER CONFIG ====');
    dump(this.router.config);

    // B) trazado resumido de lazy-loads y guards en runtime
    this.router.events.subscribe(e => {
      if (e instanceof RouteConfigLoadStart)  console.log('⏳ Lazy loading start:', e.route?.path);
      if (e instanceof RouteConfigLoadEnd)    console.log('✅ Lazy loading end:', e.route?.path);
      if (e instanceof GuardsCheckStart)      console.log('🛡️ GuardsCheckStart:', e.url);
      if (e instanceof GuardsCheckEnd)        console.log('🛡️ GuardsCheckEnd:', e.url, '=>', e.shouldActivate ? 'ALLOW' : 'BLOCK');
    });

    this.router.events.pipe(filter(ev => ev instanceof NavigationEnd))
      .subscribe(() => {
        let node = this.router.routerState.root;
        while (node.firstChild) node = node.firstChild;
        console.log(
          '➡️ Ruta activada:',
          node.snapshot.routeConfig?.path || '(vacía)',
          'params:', node.snapshot.params,
          'data:', node.snapshot.data
        );
      });
  }
}
