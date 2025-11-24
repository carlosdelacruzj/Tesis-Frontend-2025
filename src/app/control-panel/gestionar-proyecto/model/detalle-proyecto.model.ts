export interface PedidoRequerimientos {
  pedidoId: number;
  totales: RequerimientosTotales;
}

export interface RequerimientosTotales {
  personal: RequerimientoPersonal[];
  equipos: RequerimientoEquipo[];
}

export interface RequerimientoPersonal {
  rol: string;
  cantidad: number;
}

export interface RequerimientoEquipo {
  tipoEquipoId: number;
  tipoEquipo: string;
  cantidad: number;
}
