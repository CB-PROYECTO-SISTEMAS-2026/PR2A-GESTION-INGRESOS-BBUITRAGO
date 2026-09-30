import { BadRequestException } from '@nestjs/common';

export const MAX_EVENT_SPAN_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ScheduleInput {
  fechaInicio: string;
  fechaFin?: string | null;
  horaInicio: string;
  horaFin: string;
}

export interface Schedule {
  fechaInicio: string;
  fechaFin: string | null;
  horaInicio: string;
  horaFin: string;
  days: string[];
}

export function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Día calendario como Date a medianoche UTC (lo que Prisma espera para columnas DATE). */
export function dayToDate(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}

export function dateToDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isValidDay(day: string) {
  if (!DAY_RE.test(day)) return false;
  return dateToDay(dayToDate(day)) === day;
}

function daysBetween(start: string, end: string) {
  return Math.round((dayToDate(end).getTime() - dayToDate(start).getTime()) / DAY_MS);
}

export function expandDays(start: string, end: string | null) {
  if (!end) return [start];
  const total = daysBetween(start, end);
  return Array.from({ length: total + 1 }, (_, i) => dateToDay(new Date(dayToDate(start).getTime() + i * DAY_MS)));
}

/**
 * Reglas de duración del evento:
 * - Un solo día por defecto; varios días solo si hay fecha de fin.
 * - Ninguna fecha puede ser anterior a hoy (cuando se validan fechas nuevas).
 * - Inicio y fin no pueden ser el mismo día, ni el inicio posterior al fin.
 * - Máximo 1 año entre inicio y fin.
 * - Mismo horario para todos los días; la hora de fin debe ser posterior a la de inicio.
 */
export function buildSchedule(input: ScheduleInput, opts: { today: string; allowPast?: boolean }): Schedule {
  const fechaInicio = input.fechaInicio?.trim();
  const fechaFin = input.fechaFin?.trim() || null;
  const { horaInicio, horaFin } = input;

  if (!fechaInicio || !isValidDay(fechaInicio)) throw new BadRequestException('Selecciona una fecha de inicio válida.');
  if (fechaFin && !isValidDay(fechaFin)) throw new BadRequestException('Selecciona una fecha de fin válida.');
  if (!opts.allowPast && fechaInicio < opts.today) {
    throw new BadRequestException('La fecha de inicio no puede ser anterior a hoy.');
  }
  if (!horaInicio || !horaFin) throw new BadRequestException('Indica la hora de inicio y la hora de fin del evento.');
  if (horaFin <= horaInicio) throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio.');

  if (fechaFin) {
    if (!opts.allowPast && fechaFin < opts.today) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a hoy.');
    }
    if (fechaFin === fechaInicio) {
      throw new BadRequestException(
        'Las fechas de inicio y fin son la misma. Selecciona que el evento durará un solo día.',
      );
    }
    if (fechaInicio > fechaFin) {
      throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }
    if (daysBetween(fechaInicio, fechaFin) > MAX_EVENT_SPAN_DAYS) {
      throw new BadRequestException(
        'Entre la fecha de inicio y la fecha de fin solo puede haber hasta 1 año de diferencia.',
      );
    }
  }

  return { fechaInicio, fechaFin, horaInicio, horaFin, days: expandDays(fechaInicio, fechaFin) };
}
