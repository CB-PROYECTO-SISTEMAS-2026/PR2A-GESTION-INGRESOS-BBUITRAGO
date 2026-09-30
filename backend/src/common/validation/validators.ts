import { TransformFnParams } from 'class-transformer';
import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_CAPACIDAD = 20_000;
export const MAX_PRECIO = 100_000;

const INT_RE = /^\d+$/;
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

function rawValue({ obj, key, value }: TransformFnParams): unknown {
  return obj && key in obj ? (obj as Record<string, unknown>)[key] : value;
}

export const emptyToUndefined = ({ value }: TransformFnParams) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const trimString = ({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value);

/**
 * Solo acepta enteros escritos con dígitos ("120" o 120). Valores como "12.5", "1e3", "-4" o "12abc"
 * se dejan sin convertir para que @IsInt los rechace (la conversión implícita los aceptaría).
 */
export const toStrictInt = (params: TransformFnParams) => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null) return raw;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    if (INT_RE.test(trimmed)) return Number(trimmed);
  }
  return raw;
};

/** Montos en Bs: dígitos con hasta 2 decimales. */
export const toStrictMoney = (params: TransformFnParams) => {
  const raw = rawValue(params);
  if (raw === undefined || raw === null) return raw;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    if (MONEY_RE.test(trimmed)) return Number(trimmed);
  }
  return raw;
};

export function isGoogleMapsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl') return url.pathname.length > 1;
  if (host === 'goo.gl') return url.pathname.startsWith('/maps');
  if (/^maps\.google\.[a-z.]+$/.test(host)) return true;
  if (/^(www\.)?google\.[a-z.]+$/.test(host)) return url.pathname.startsWith('/maps');
  return false;
}

export function IsGoogleMapsUrl(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isGoogleMapsUrl',
      validator: {
        validate: (value) => isGoogleMapsUrl(value),
        defaultMessage: () => 'Pega un enlace válido de Google Maps.',
      },
    },
    options,
  );
}
