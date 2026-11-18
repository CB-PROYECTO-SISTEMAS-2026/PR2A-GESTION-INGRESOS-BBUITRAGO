import { dateToDay, dayToDate } from '../events/event-schedule';
import { dayIn, startOfDayIn, type FechaHorario } from '../pos/pos-dates';

/** Días que tiene el cliente, desde el fin del evento, para retirar el saldo que le sobró. */
export const PLAZO_RETIRO_DIAS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function sumarDias(day: string, dias: number) {
  return dateToDay(new Date(dayToDate(day).getTime() + dias * DAY_MS));
}

/**
 * Instante en que termina el evento: el cierre (`horaFin`) de su último día. Si ese horario cruza
 * la medianoche (p. ej. 20:00–02:00), termina la madrugada del día siguiente. Null si el evento
 * no tiene fechas.
 *
 * No se usa el estado FINALIZADO del evento porque nadie lo marca al terminar; un evento
 * CANCELADO también usa la última fecha que tenía programada.
 */
export function fechaFinEvento(
  fechas: FechaHorario[],
  timeZone: string,
): Date | null {
  if (!fechas.length) return null;
  const ultima = fechas.reduce((a, b) =>
    dateToDay(b.fecha) > dateToDay(a.fecha) ? b : a,
  );
  const inicio = toMinutes(ultima.horaInicio);
  const fin = toMinutes(ultima.horaFin);
  const dia = dateToDay(ultima.fecha);
  const diaCierre = fin <= inicio ? sumarDias(dia, 1) : dia;
  return new Date(startOfDayIn(diaCierre, timeZone).getTime() + fin * 60_000);
}

export interface PlazoRetiro {
  /** Último día ("AAAA-MM-DD") en que todavía se puede retirar el saldo, inclusive. */
  fechaLimite: string;
  /** Instante desde el que el saldo ya no se puede retirar (inicio del día siguiente al límite). */
  venceAt: Date;
  vencido: boolean;
  /** Días que quedan contando hoy (0 si ya venció). */
  diasRestantes: number;
}

/**
 * Regla única del plazo de retiro (Sprint 3): el cliente tiene hasta el final del día número
 * `PLAZO_RETIRO_DIAS` contado desde el día en que terminó el evento, en la zona horaria del
 * sistema. Vencido el plazo, el saldo deja de estar disponible para devolución.
 */
export function calcularPlazoRetiro(
  fechaFin: Date,
  timeZone: string,
  now = new Date(),
): PlazoRetiro {
  const fechaLimite = sumarDias(dayIn(fechaFin, timeZone), PLAZO_RETIRO_DIAS);
  const venceAt = startOfDayIn(sumarDias(fechaLimite, 1), timeZone);
  const vencido = now.getTime() >= venceAt.getTime();
  const hoy = dayIn(now, timeZone);
  const diasRestantes = vencido
    ? 0
    : Math.round(
        (dayToDate(fechaLimite).getTime() - dayToDate(hoy).getTime()) / DAY_MS,
      ) + 1;
  return { fechaLimite, venceAt, vencido, diasRestantes };
}

/** Plazo de retiro de un evento a partir de sus fechas; null si el evento no tiene fechas. */
export function plazoRetiroEvento(
  fechas: FechaHorario[],
  timeZone: string,
  now = new Date(),
): PlazoRetiro | null {
  const fin = fechaFinEvento(fechas, timeZone);
  return fin ? calcularPlazoRetiro(fin, timeZone, now) : null;
}
