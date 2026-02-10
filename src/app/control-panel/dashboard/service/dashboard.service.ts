import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { DashboardHomeResponse } from '../model/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.baseUrl}/operaciones`;

  getDashboardHome(): Observable<DashboardHomeResponse> {
    const params = new HttpParams()
      .set('baseDate', this.getCurrentLocalYmd());

    return this.http.get<DashboardHomeResponse>(`${this.API}/dashboard/home`, { params });
  }

  private getCurrentLocalYmd(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
