/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA (FRONTEND) · Formato de montos, fechas, horas y mensajes de error
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Las funciones de frontend/src/utils/format.js que usan casi todas las pantallas:
 *      - formatBs: montos en bolivianos ("Bs 1.234,50"), con decimales solo si hacen falta.
 *      - formatDay / formatDayRange / toDay: fechas de eventos SIN correrse un día por la zona
 *        horaria (las fechas llegan como medianoche UTC y Bolivia está en UTC-4).
 *      - localDay: el día de hoy (y días atrás) en la hora del navegador, para los filtros.
 *      - formatTime: la hora "14:05" de una venta.
 *      - getErrorMessage: el mensaje que se muestra al usuario cuando falla una petición.
 *
 *  POR QUÉ IMPORTA
 *    Un monto mal formateado confunde al cajero; una fecha corrida un día muestra un evento
 *    en el día equivocado; un mensaje de error técnico no le dice al usuario qué hacer.
 *
 *  CÓDIGO PROBADO
 *    frontend/src/utils/format.js
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                                         (solo la primera vez)
 *    npm run test:frontend                               (todas las del frontend)
 *    npx vitest run frontend-unit/utils/format.test.js   (solo este archivo)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, backend ni navegador real (jsdom simula el navegador).
 *    La zona horaria de las pruebas es America/La_Paz (vitest.config.mjs).
 *
 *  CÓMO LEER EL RESULTADO / SI FALLA
 *    Cada caso muestra la entrada y el texto esperado. Si cambia el formato a propósito
 *    (p. ej. otro separador de miles), actualiza aquí el texto esperado.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatBs,
  formatDay,
  formatDayRange,
  formatTime,
  getErrorMessage,
  localDay,
  toDay,
} from '../../../frontend/src/utils/format';

describe('formatBs(): montos en bolivianos', () => {
  it.each([
    [26, 'Bs 26'],
    ['26.00', 'Bs 26'],
    [8.5, 'Bs 8,50'],
    [1234.5, 'Bs 1.234,50'],
    [1234567, 'Bs 1.234.567'],
    [0, 'Bs 0'],
  ])('formatBs(%p) = %p', (entrada, esperado) => {
    expect(formatBs(entrada)).toBe(esperado);
  });

  it('muestra "Bs —" si el valor no es un número', () => {
    expect(formatBs('abc')).toBe('Bs —');
    expect(formatBs(undefined)).toBe('Bs —');
  });
});

describe('Fechas de eventos sin correrse por la zona horaria', () => {
  it('toDay toma solo la parte AAAA-MM-DD', () => {
    expect(toDay('2026-10-05T00:00:00.000Z')).toBe('2026-10-05');
    expect(toDay(null)).toBe('');
  });

  it('formatDay muestra el mismo día que guarda la base (no el día anterior)', () => {
    // Medianoche UTC del 5 de octubre = 20:00 del 4 de octubre en Bolivia: igual debe decir 5.
    expect(formatDay('2026-10-05T00:00:00.000Z')).toBe('5 oct 2026');
  });

  it('formatDayRange muestra un día o un rango', () => {
    expect(formatDayRange('2026-10-05', '2026-10-05')).toBe('5 oct 2026');
    expect(formatDayRange('2026-10-05', '2026-10-07')).toBe('5 oct 2026 – 7 oct 2026');
    expect(formatDayRange(null)).toBe('—');
  });
});

describe('localDay(): días para los filtros de fecha', () => {
  afterEach(() => vi.useRealTimers());

  it('devuelve hoy y días atrás en hora local (La Paz)', () => {
    // 22:00 en La Paz del 10/10 (en UTC ya es 11/10): sigue siendo el 10.
    vi.useFakeTimers({ now: new Date('2026-10-11T02:00:00.000Z') });
    expect(localDay()).toBe('2026-10-10');
    expect(localDay(-6)).toBe('2026-10-04');
    expect(localDay(-29)).toBe('2026-09-11');
  });
});

describe('formatTime(): hora de una venta', () => {
  it('muestra la hora local en formato 24 h', () => {
    expect(formatTime('2026-10-10T18:05:00.000Z')).toBe('14:05');
  });

  it('muestra "—" sin valor', () => {
    expect(formatTime(null)).toBe('—');
  });
});

describe('getErrorMessage(): mensajes de error para el usuario', () => {
  it('usa el mensaje del servidor', () => {
    const err = { response: { status: 409, data: { message: 'Saldo insuficiente.' } } };
    expect(getErrorMessage(err)).toBe('Saldo insuficiente.');
  });

  it('une la lista de errores de validación, sin repetir y con punto final', () => {
    const err = {
      response: {
        status: 400,
        data: { message: ['La cantidad mínima es 1', 'La cantidad mínima es 1', 'Correo inválido.'] },
      },
    };
    expect(getErrorMessage(err)).toBe('La cantidad mínima es 1. Correo inválido.');
  });

  it('explica el límite de peticiones (429) en lenguaje claro', () => {
    expect(getErrorMessage({ response: { status: 429, data: {} } })).toBe(
      'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    );
  });

  it('explica cuando no hay conexión con el servidor', () => {
    expect(getErrorMessage({ request: {} })).toBe('No se pudo conectar con el servidor. Revisa tu conexión.');
  });

  it('usa el mensaje por defecto si no hay información', () => {
    expect(getErrorMessage({}, 'No se pudo cobrar')).toBe('No se pudo cobrar');
  });
});
