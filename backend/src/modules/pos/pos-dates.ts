import { BadRequestException } from '@nestjs/common';
import { dayToDate, todayIn } from '../events/event-schedule';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_RANGE_DAYS = 92;

/** Desfase de la zona horaria respecto a UTC en minutos (La Paz: -240). */
function offsetMinutes(at: Date, timeZone: string) {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** Instante UTC en que empieza el día `day` ("AAAA-MM-DD") en la zona horaria dada. */
export function startOfDayIn(day: string, timeZone: string) {
  const utcMidnight = dayToDate(day);
  return new Date(
    utcMidnight.getTime() - offsetMinutes(utcMidnight, timeZone) * 60_000,
  );
}

/** Día calendario ("AAAA-MM-DD") de un instante en la zona horaria dada. */
export function dayIn(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export interface DayRange {
  desde: string;
  hasta: string;
  /** Inicio del rango (inclusive) y fin (exclusivo), en UTC, para filtrar `createdAt`. */
  gte: Date;
  lt: Date;
}

/** Rango de días inclusivo; sin parámetros es el día de hoy. */
export function resolveDayRange(
  timeZone: string,
  desde?: string,
  hasta?: string,
): DayRange {
  const today = todayIn(timeZone);
  const from = desde || hasta || today;
  const to = hasta || desde || today;
  if (!DAY_RE.test(from) || !DAY_RE.test(to)) {
    throw new BadRequestException(
      'Las fechas deben tener el formato AAAA-MM-DD.',
    );
  }
  if (from > to)
    throw new BadRequestException(
      'La fecha inicial no puede ser posterior a la final.',
    );
  const span = Math.round(
    (dayToDate(to).getTime() - dayToDate(from).getTime()) / DAY_MS,
  );
  if (span >= MAX_RANGE_DAYS) {
    throw new BadRequestException(
      `El rango no puede superar ${MAX_RANGE_DAYS} días.`,
    );
  }
  const next = new Date(dayToDate(to).getTime() + DAY_MS)
    .toISOString()
    .slice(0, 10);
  return {
    desde: from,
    hasta: to,
    gte: startOfDayIn(from, timeZone),
    lt: startOfDayIn(next, timeZone),
  };
}
