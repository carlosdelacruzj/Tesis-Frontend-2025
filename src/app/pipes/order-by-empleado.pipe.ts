import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'orderByEmpleado',
  standalone: true
})
export class OrderByEmpleadoPipe implements PipeTransform {
  transform<T extends { empleadoNombre?: string | null }>(value: T[] | null | undefined): T[] {
    if (!Array.isArray(value)) return [] as T[];
    return [...value].sort((a, b) => {
      const va = (a.empleadoNombre ?? '').toLowerCase();
      const vb = (b.empleadoNombre ?? '').toLowerCase();
      return va.localeCompare(vb);
    });
  }
}
