import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'usd',
  standalone: true
})
export class UsdPipe implements PipeTransform {
  transform(value: unknown, digitsInfo = '1.2-2'): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const raw = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(raw)) {
      return '—';
    }
    const { minFractionDigits, maxFractionDigits } = this.parseDigitsInfo(digitsInfo);
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits
    });
    return `US$ ${formatter.format(raw)}`;
  }

  private parseDigitsInfo(digitsInfo: string): { minFractionDigits: number; maxFractionDigits: number } {
    const parts = digitsInfo.split('.');
    const fraction = parts[1] ?? '2-2';
    const [minStr, maxStr] = fraction.split('-');
    const minFractionDigits = Math.max(0, Number(minStr) || 0);
    const maxFractionDigits = Math.max(minFractionDigits, Number(maxStr ?? minStr) || minFractionDigits);
    return { minFractionDigits, maxFractionDigits };
  }
}
