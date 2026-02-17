export interface PerfilCatalogo {
  idPerfil: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface CrearPerfilPayload {
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface CrearPerfilResponse {
  message: string;
  perfil: PerfilCatalogo;
}

export interface ActualizarPerfilPayload {
  nombre: string;
  descripcion: string;
}

export interface ActualizarPerfilResponse {
  message: string;
  perfil: PerfilCatalogo;
}

export interface CambiarEstadoPerfilPayload {
  activo: boolean;
}

export interface CambiarEstadoPerfilResponse {
  message: string;
  perfil: {
    idPerfil: number;
    codigo: string;
    nombre: string;
    activo: boolean;
  };
}

export interface UsuarioBasico {
  usuarioId: number;
  correo: string;
}

export interface PerfilUsuario {
  idPerfil: number;
  codigo: string;
  nombre: string;
  principal: boolean;
  activo: boolean;
}

export interface UsuarioPerfilesResponse {
  usuario: UsuarioBasico;
  perfiles: PerfilUsuario[];
}

export interface AsignarPerfilPayload {
  perfilId?: number;
  perfilCodigo?: string;
  principal?: boolean;
}

export interface AsignarPerfilResponse {
  message: string;
  usuarioId: number;
  perfil: {
    idPerfil: number;
    codigo: string;
    nombre: string;
  };
  principal: boolean;
}

export interface RemoverPerfilResponse {
  message: string;
  usuarioId: number;
  perfil: {
    idPerfil: number;
    codigo: string;
    nombre: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  message: string;
}
