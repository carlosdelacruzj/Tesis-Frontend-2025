import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ComprobantesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.baseUrl;

  getVoucherPdf(voucherId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/comprobantes/vouchers/${voucherId}/pdf`, {
      responseType: 'blob'
    });
  }
}
