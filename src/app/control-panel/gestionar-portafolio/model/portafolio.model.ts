export interface PortafolioEvento {
  id: number;
  nombre: string;
  iconUrl?: string | null;
  mostrarPortafolio: number;
}

export interface PortafolioImagen {
  id: number;
  eventoId: number;
  url: string;
  titulo?: string | null;
  descripcion?: string | null;
  orden?: number | null;
  fechaCreacion?: string | null;
}

export interface PortafolioPublico extends PortafolioEvento {
  imagenes: PortafolioImagen[];
}

export interface PortafolioRespuesta {
  Status: string;
}
