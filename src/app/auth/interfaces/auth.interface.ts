export interface Usuario {
    id: number;
    clienteId: number | null;
    correo: string;
    nombres: string;
    apellidos: string;
    empleadoId: number | null;
    tipoEmpleado: string;
}

export interface AuthResponse {
    token: string;
    usuario: Usuario;
}

export interface AuthErrorResponse {
    success: false;
    message: string;
}
