export interface CalendarioMensualResponse {
  generatedAt: string;
  month: CalendarioMonthInfo;
  resumen: CalendarioResumenMensual;
  dias: CalendarioDiaMensual[];
}

export interface CalendarioMonthInfo {
  year: number;
  month: number;
  from: string;
  to: string;
}

export interface CalendarioResumenMensual {
  totalProyectoDiasMes: number;
  totalProyectosUnicosMes: number;
  diasConActividad: number;
}

export interface CalendarioDiaMensual {
  fecha: string;
  totalItems: number;
  items: CalendarioDiaMensualItem[];
}

export interface CalendarioDiaMensualItem {
  diaId: number;
  proyectoId: number;
  proyectoNombre: string;
  estadoDia: string | null;
  hora: string | null;
}

export interface CalendarioDiaDetalleResponse {
  generatedAt: string;
  fecha: string;
  totalItems: number;
  items: CalendarioDiaDetalleItem[];
}

export interface CalendarioDiaDetalleItem {
  diaId: number;
  proyectoId: number;
  proyectoNombre: string;
  estadoProyecto: string | null;
  estadoDia: string | null;
  horaInicio: string | null;
  bloques: CalendarioBloque[];
  locaciones: CalendarioLocacion[];
  servicios: CalendarioServicio[];
}

export interface CalendarioBloque {
  hora: string | null;
  ubicacion: string | null;
  direccion: string | null;
}

export interface CalendarioLocacion {
  ubicacion: string | null;
  direccion: string | null;
}

export interface CalendarioServicio {
  servicioId: number;
  nombre: string | null;
}
