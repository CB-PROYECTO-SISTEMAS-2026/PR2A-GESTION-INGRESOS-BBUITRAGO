import { BadRequestException } from '@nestjs/common';

export interface Actividad {
  hora: string;
  actividad: string;
}

export interface Cronograma {
  apertura: string;
  cierre: string;
  actividades: Actividad[];
}

/** Quita espacios sobrantes y repetidos (sin distinguir mayúsculas), conservando el orden. */
export function normalizeList(items: string[] | undefined | null): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items ?? []) {
    const item = raw.replace(/\s+/g, ' ').trim();
    const key = item.toLocaleLowerCase('es');
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * La apertura de puertas y el cierre del evento son siempre la hora de inicio y la hora de fin
 * del evento: el horario se define en un solo lugar. Las actividades deben quedar dentro de ese
 * rango y se guardan ordenadas por hora.
 */
export function buildCronograma(
  input: Pick<Cronograma, 'actividades'> | null | undefined,
  horario: { horaInicio: string; horaFin: string },
): Cronograma {
  const apertura = horario.horaInicio;
  const cierre = horario.horaFin;
  const actividades = (input?.actividades ?? []).map((a) => ({
    hora: a.hora,
    actividad: a.actividad.replace(/\s+/g, ' ').trim(),
  }));
  for (const a of actividades) {
    if (a.hora < apertura || a.hora > cierre) {
      throw new BadRequestException(
        `La actividad "${a.actividad}" (${a.hora}) está fuera del horario del evento, de ${apertura} a ${cierre}.`,
      );
    }
  }
  actividades.sort((a, b) => a.hora.localeCompare(b.hora));
  return { apertura, cierre, actividades };
}

export function isCronograma(value: unknown): value is Cronograma {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<Cronograma>;
  return typeof c.apertura === 'string' && typeof c.cierre === 'string' && Array.isArray(c.actividades);
}
