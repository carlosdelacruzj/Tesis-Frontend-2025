import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly API_PRUEBA = 'https://rickandmortyapi.com/api/character';

  public getAllNombres(): Observable<unknown> {
    return this.http.get(this.API_PRUEBA);
  }
}
