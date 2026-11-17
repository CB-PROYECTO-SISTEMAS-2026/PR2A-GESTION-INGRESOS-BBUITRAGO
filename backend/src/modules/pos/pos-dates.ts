import { BadRequestException } from '@nestjs/common';
import { dateToDay, dayToDate, todayIn } from '../events/event-schedule';

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

/**
 * "AAAA-MM-DD" que existe en el calendario. Sin esta comprobación, "2026-02-30" se convertiría
 * en silencio al 2 de marzo y "2026-13-01" en una fecha inválida.
 */
function isCalendarDay(day: string) {
  if (!DAY_RE.test(day)) return false;
  const date = dayToDate(day);
  return !Number.isNaN(date.getTime()) && dateToDay(date) === day;
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
  if (!isCalendarDay(from) || !isCalendarDay(to)) {
    throw new BadRequestException('La fecha indicada no existe.');
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

/** Margen para cobrar antes de la apertura y después del cierre (preparar y cerrar caja). */
export const MARGEN_HORARIO_MIN = 30;

export interface FechaHorario {
  fecha: Date;
  horaInicio: string;
  horaFin: string;
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Minuto del día (0–1439) de un instante en la zona horaria dada. */
export function minuteOfDayIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (value('hour') % 24) * 60 + value('minute');
}

/**
 * Indica si un evento está abierto ahora según el horario de sus días. Un horario que cruza la
 * medianoche (p. ej. 20:00–02:00) sigue abierto la madrugada del día siguiente.
 */
export function horarioActual(
  fechas: FechaHorario[],
  timeZone: string,
  now = new Date(),
) {
  const today = dayIn(now, timeZone);
  const yesterday = dateToDay(new Date(dayToDate(today).getTime() - DAY_MS));
  const minuto = minuteOfDayIn(now, timeZone);
  let abierto = false;
  let horarioHoy: string | null = null;

  for (const f of fechas) {
    const dia = dateToDay(f.fecha);
    const inicio = toMinutes(f.horaInicio);
    const fin = toMinutes(f.horaFin);
    const cruzaMedianoche = fin <= inicio;
    if (dia === today) {
      horarioHoy = `${f.horaInicio} – ${f.horaFin}`;
      if (
        minuto >= inicio - MARGEN_HORARIO_MIN &&
        (cruzaMedianoche || minuto < fin + MARGEN_HORARIO_MIN)
      ) {
        abierto = true;
      }
    } else if (
      dia === yesterday &&
      cruzaMedianoche &&
      minuto < fin + MARGEN_HORARIO_MIN
    ) {
      abierto = true;
    }
  }
  return { abierto, horarioHoy };
}
