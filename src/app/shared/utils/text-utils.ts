export function corregirCumple(nombre: string): string {
  if (!nombre) return nombre;

  // Corrige solo si viene exactamente "cumpleanos" (con cualquier mayúscula/minúscula)
  if (nombre.toLowerCase() === 'cumpleanos') {
    if (nombre === nombre.toUpperCase()) return 'CUMPLEAÑOS';
    if (nombre[0] === nombre[0].toUpperCase()) return 'Cumpleaños';
    return 'cumpleaños';
  }

  return nombre;
}
