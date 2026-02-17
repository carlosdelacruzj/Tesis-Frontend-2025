export type FinancialStatusCode = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'CERRADO';

export interface FinancialStatusResult {
  code: FinancialStatusCode;
  label: 'Pendiente' | 'Parcial' | 'Pagado' | 'Cerrado';
  allowPayment: boolean;
  isSettled: boolean;
  closedByCreditNote: boolean;
}

export interface FinancialStatusInput {
  estadoLabel?: string | null;
  montoAbonado?: unknown;
  saldoPendiente?: unknown;
  montoPorDevolver?: unknown;
  notasCredito?: unknown;
}

export function deriveFinancialStatus(input: FinancialStatusInput): FinancialStatusResult {
  const estadoLabel = normalizeLabel(input.estadoLabel);
  const montoAbonado = parseAmount(input.montoAbonado);
  const saldoPendiente = clampToZero(parseAmount(input.saldoPendiente));
  const montoPorDevolver = clampToZero(parseAmount(input.montoPorDevolver));
  const notasCredito = clampToZero(parseAmount(input.notasCredito));
  const closedByCreditNote = montoPorDevolver > 0 || notasCredito > 0;

  // Prioriza etiquetas explicitas cuando vienen del backend/listado.
  if (['pendiente', 'pendientes', 'sin pago', 'sin pagos', 'no pagado'].includes(estadoLabel)) {
    return toResult('PENDIENTE');
  }
  if (['parcial', 'parciales', 'parcialmente pagado', 'abono'].includes(estadoLabel)) {
    return toResult('PARCIAL');
  }
  if (['pagado', 'pagados', 'pagado total'].includes(estadoLabel)) {
    return toResult('PAGADO');
  }
  if (['cerrado', 'cerrados'].includes(estadoLabel)) {
    return toResult('CERRADO', closedByCreditNote);
  }

  if (saldoPendiente <= 0) {
    return toResult(closedByCreditNote ? 'CERRADO' : 'PAGADO', closedByCreditNote);
  }

  if (montoAbonado > 0) {
    return toResult('PARCIAL');
  }

  return toResult('PENDIENTE');
}

function toResult(code: FinancialStatusCode, closedByCreditNote = false): FinancialStatusResult {
  if (code === 'PENDIENTE') {
    return { code, label: 'Pendiente', allowPayment: true, isSettled: false, closedByCreditNote: false };
  }
  if (code === 'PARCIAL') {
    return { code, label: 'Parcial', allowPayment: true, isSettled: false, closedByCreditNote: false };
  }
  if (code === 'PAGADO') {
    return { code, label: 'Pagado', allowPayment: false, isSettled: true, closedByCreditNote: false };
  }
  return { code, label: 'Cerrado', allowPayment: false, isSettled: true, closedByCreditNote };
}

function normalizeLabel(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function clampToZero(value: number): number {
  return value > 0 ? value : 0;
}

function parseAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const sanitized = String(value)
    .replace(/\s+/g, '')
    .replace(/[^0-9,.-]/g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
}
