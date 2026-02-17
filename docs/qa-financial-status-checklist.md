# QA Financial Status Checklist

## Objetivo
Validar que la UI y la logica de estado financiero esten alineadas para `Pendiente`, `Parcial`, `Pagado` y `Cerrado`.

## Casos Borde

1. `SaldoPendiente = 0` y `MontoPorDevolver > 0`
- Esperado: estado derivado `Cerrado`.
- UI: badge `Cerrado`, cobro bloqueado, mensaje de cierre financiero.

2. `SaldoPendiente = 0` y `NotasCredito > 0`
- Esperado: estado derivado `Cerrado`.
- UI: microcopy `Operacion cerrada con nota de credito/devolucion.`

3. Parcial con multiples abonos (`MontoAbonado > 0` y `SaldoPendiente > 0`)
- Esperado: estado derivado `Parcial`.
- UI: badge `Parcial`, cobro habilitado.

4. Cerrado financiero con pedido operativo en curso
- Esperado: badge de pago `Cerrado` y acciones de cobro deshabilitadas.
- UI operativa del pedido se mantiene independiente del estado financiero.

## Puntos de verificacion visual

- Tooltip del badge `Cerrado` visible en tablas de `Pagos` y `Pedidos`.
- Leyenda de estados visible en `Pagos`.
- Resumen financiero muestra campos ajustados cuando existen:
  - `CostoTotalOriginal`
  - `CostoTotalNeto`
  - `CobrosPositivos`
  - `NotasCredito`
  - `MontoPorDevolver`
