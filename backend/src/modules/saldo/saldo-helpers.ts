import { Prisma, TipoTransaccionSaldo } from '@prisma/client';
import { dateToDay } from '../events/event-schedule';
import { horarioActual, type FechaHorario } from '../pos/pos-dates';

/**
 * Monto con signo de un movimiento desde el punto de vista del cliente: las recargas suman, las
 * compras y devoluciones de saldo restan. Un AJUSTE guarda su propio signo (p. ej. la reversión
 * de una recarga anulada se registra en negativo).
 */
export function montoConSigno(
  tipo: TipoTransaccionSaldo,
  monto: Prisma.Decimal,
): Prisma.Decimal {
  switch (tipo) {
    case TipoTransaccionSaldo.RECARGA:
      return monto.abs();
    case TipoTransaccionSaldo.COMPRA_PRODUCTO:
    case TipoTransaccionSaldo.DEVOLUCION:
      return monto.abs().neg();
    default:
      return monto;
  }
}

export type EstadoTemporalEvento =
  'EN_CURSO' | 'HOY' | 'PROXIMO' | 'FINALIZADO';

/**
 * Momento del evento respecto a hoy, para mostrar al cliente y al personal:
 * abierto ahora, hoy fuera de horario, próximo o ya finalizado.
 */
export function estadoTemporal(
  fechas: FechaHorario[],
  today: string,
  timeZone: string,
  now = new Date(),
): EstadoTemporalEvento {
  const dias = fechas.map((f) => dateToDay(f.fecha)).sort();
  if (horarioActual(fechas, timeZone, now).abierto) return 'EN_CURSO';
  if (dias.includes(today)) return 'HOY';
  if (dias.length && dias[dias.length - 1] < today) return 'FINALIZADO';
  return 'PROXIMO';
}
