import { HttpClient } from '@angular/common/http';

export function urlToBase64(http: HttpClient, url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result)); // data:<mime>;base64,....
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      },
      error: reject,
    });
  });
}