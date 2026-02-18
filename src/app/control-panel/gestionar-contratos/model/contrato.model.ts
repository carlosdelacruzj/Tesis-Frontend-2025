export interface ContratoListQuery {
  estado?: string | null;
  vigente?: boolean | null;
  q?: string | null;
}

export interface ContratoGestionRow {
  contratoId: number;
  codigoContrato: string | null;
  pedidoId: number;
  codigoPedido: string | null;
  cliente: string;
  clienteDocumento: string | null;
  fechaContrato: string | null;
  estadoPedidoId: number | null;
  estadoPedidoNombre: string | null;
  versionContrato: number | string | null;
  estadoContrato: string | null;
  esVigente: boolean;
  pdfLink?: string | null;
}

export interface ContratoVersionResumen {
  id: number;
  pedidoId: number;
  version: number | string | null;
  estado: string | null;
  esVigente: boolean;
  fechaContrato?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pdfLink?: string | null;
  [key: string]: unknown;
}
