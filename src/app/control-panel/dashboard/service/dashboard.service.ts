import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { DashboardOperativoDiaResponse } from '../model/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly API = `${environment.baseUrl}/operaciones`;

  getDashboardHome(): Observable<DashboardOperativoDiaResponse> {
    const params = new HttpParams()
      .set('baseDate', this.getCurrentLocalYmd());

    return this.http.get<DashboardOperativoDiaResponse>(`${this.API}/dashboard/operativo-dia`, { params });
  }

  private getCurrentLocalYmd(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
