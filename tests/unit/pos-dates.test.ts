/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA · Horario del evento y rangos de fechas del punto de venta (Módulo E)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    1. horarioActual(): decide si un evento está ABIERTO en este momento, según el horario de
 *       cada día (FechaEvento.horaInicio / horaFin), con 30 min de margen antes de abrir y
 *       después de cerrar, e incluyendo horarios que cruzan la medianoche (p. ej. 20:00–02:00).
 *    2. resolveDayRange(): convierte "desde/hasta" (AAAA-MM-DD, hora de La Paz) en el rango UTC
 *       con el que se filtran las ventas del historial, el dashboard y el CSV.
 *    3. startOfDayIn(), dayIn(), minuteOfDayIn(): conversiones entre UTC y la hora de La Paz.
 *
 *  POR QUÉ IMPORTA
 *    - Si el horario se calcula mal, el POS cobra fuera del evento o bloquea cobros válidos.
 *    - Si el rango se calcula mal, una venta de las 21:00 aparece en el día siguiente (Bolivia
 *      está en UTC-4) y los totales del día no cuadran con la caja.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/pos/pos-dates.ts
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                         (solo la primera vez)
 *    npx jest unit/pos-dates.test.ts     (solo este archivo)
 *    npm run test:unit                   (todas las pruebas unitarias)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, servidor ni internet. Tampoco depende de la hora real de la
 *    máquina: cada caso fija el instante exacto que quiere probar.
 *
 *  CÓMO LEER EL RESULTADO
 *    Cada `it(...)` describe una regla en español. Si una falla, Jest muestra el valor esperado
 *    (Expected) y el obtenido (Received). Recuerda: La Paz = UTC-4, así que las 20:00 de La Paz
 *    son las 00:00 UTC del día siguiente.
 *
 *  SI FALLA
 *    Alguien cambió la lógica de horarios o fechas. Revisa pos-dates.ts: si el cambio fue
 *    intencional (p. ej. otro margen), actualiza aquí la regla correspondiente.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { BadRequestException } from '@nestjs/common';
import {
  MARGEN_HORARIO_MIN,
  dayIn,
  horarioActual,
  minuteOfDayIn,
  resolveDayRange,
  startOfDayIn,
} from '../../backend/src/modules/pos/pos-dates';

const TZ = 'America/La_Paz';

/** Día del evento como lo guarda Prisma (columna DATE = medianoche UTC). */
const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);

/** Instante a partir de la hora local de La Paz (UTC-4, sin horario de verano). */
const laPaz = (fecha: string, hora: string) =>
  new Date(new Date(`${fecha}T${hora}:00.000Z`).getTime() + 4 * 3600_000);

describe('Conversiones de zona horaria (La Paz, UTC-4)', () => {
  it('el día en La Paz empieza a las 04:00 UTC', () => {
    expect(startOfDayIn('2026-10-10', TZ).toISOString()).toBe(
      '2026-10-10T04:00:00.000Z',
    );
  });

  it('las 23:59 de La Paz siguen siendo el mismo día aunque en UTC ya sea el siguiente', () => {
    expect(dayIn(laPaz('2026-10-10', '23:59'), TZ)).toBe('2026-10-10');
    expect(dayIn(laPaz('2026-10-11', '00:00'), TZ)).toBe('2026-10-11');
  });

  it('calcula el minuto del día en hora local', () => {
    expect(minuteOfDayIn(laPaz('2026-10-10', '00:00'), TZ)).toBe(0);
    expect(minuteOfDayIn(laPaz('2026-10-10', '18:30'), TZ)).toBe(18 * 60 + 30);
  });
});

describe('horarioActual(): ¿el evento está abierto ahora?', () => {
  const evento18a23 = [
    { fecha: dia('2026-10-10'), horaInicio: '18:00', horaFin: '23:00' },
  ];

  it(`usa un margen de ${MARGEN_HORARIO_MIN} minutos`, () => {
    expect(MARGEN_HORARIO_MIN).toBe(30);
  });

  it('está abierto dentro del horario y devuelve el horario de hoy', () => {
    expect(horarioActual(evento18a23, TZ, laPaz('2026-10-10', '20:00'))).toEqual({
      abierto: true,
      horarioHoy: '18:00 – 23:00',
    });
  });

  it('permite cobrar desde 30 min antes de abrir (17:30), no antes (17:29)', () => {
    expect(horarioActual(evento18a23, TZ, laPaz('2026-10-10', '17:30')).abierto).toBe(true);
    expect(horarioActual(evento18a23, TZ, laPaz('2026-10-10', '17:29')).abierto).toBe(false);
  });

  it('permite cobrar hasta 30 min después de cerrar (23:29), no después (23:30)', () => {
    expect(horarioActual(evento18a23, TZ, laPaz('2026-10-10', '23:29')).abierto).toBe(true);
    expect(horarioActual(evento18a23, TZ, laPaz('2026-10-10', '23:30')).abierto).toBe(false);
  });

  it('está cerrado un día que no es del evento', () => {
    expect(horarioActual(evento18a23, TZ, laPaz('2026-10-11', '20:00'))).toEqual({
      abierto: false,
      horarioHoy: null,
    });
  });

  describe('horario que cruza la medianoche (20:00 – 02:00)', () => {
    const fiesta = [{ fecha: dia('2026-10-10'), horaInicio: '20:00', horaFin: '02:00' }];

    it('está abierto en la noche del día del evento', () => {
      expect(horarioActual(fiesta, TZ, laPaz('2026-10-10', '23:00'))).toEqual({
        abierto: true,
        horarioHoy: '20:00 – 02:00',
      });
    });

    it('sigue abierto la madrugada del día siguiente, con margen hasta las 02:29', () => {
      expect(horarioActual(fiesta, TZ, laPaz('2026-10-11', '01:00')).abierto).toBe(true);
      expect(horarioActual(fiesta, TZ, laPaz('2026-10-11', '02:29')).abierto).toBe(true);
    });

    it('cierra a las 02:30 del día siguiente', () => {
      expect(horarioActual(fiesta, TZ, laPaz('2026-10-11', '02:30')).abierto).toBe(false);
    });

    it('no está abierto en la madrugada ANTERIOR al evento', () => {
      expect(horarioActual(fiesta, TZ, laPaz('2026-10-10', '01:00')).abierto).toBe(false);
    });
  });

  it('en un evento de varios días usa el horario del día actual', () => {
    const feria = [
      { fecha: dia('2026-10-10'), horaInicio: '09:00', horaFin: '18:00' },
      { fecha: dia('2026-10-11'), horaInicio: '10:00', horaFin: '14:00' },
    ];
    expect(horarioActual(feria, TZ, laPaz('2026-10-11', '15:00'))).toEqual({
      abierto: false,
      horarioHoy: '10:00 – 14:00',
    });
    expect(horarioActual(feria, TZ, laPaz('2026-10-11', '11:00')).abierto).toBe(true);
  });
});

describe('resolveDayRange(): rango de días para filtrar ventas', () => {
  afterEach(() => jest.useRealTimers());

  it('convierte el rango a UTC: desde las 04:00 del primer día hasta las 04:00 del día siguiente al último', () => {
    const r = resolveDayRange(TZ, '2026-10-01', '2026-10-03');
    expect(r.desde).toBe('2026-10-01');
    expect(r.hasta).toBe('2026-10-03');
    expect(r.gte.toISOString()).toBe('2026-10-01T04:00:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-10-04T04:00:00.000Z');
  });

  it('sin fechas usa el día de hoy en La Paz', () => {
    jest.useFakeTimers({ now: laPaz('2026-10-10', '21:00') }); // en UTC ya es 11/10
    const r = resolveDayRange(TZ);
    expect(r.desde).toBe('2026-10-10');
    expect(r.hasta).toBe('2026-10-10');
  });

  it('con una sola fecha, el rango es ese único día', () => {
    expect(resolveDayRange(TZ, '2026-10-05')).toMatchObject({
      desde: '2026-10-05',
      hasta: '2026-10-05',
    });
    expect(resolveDayRange(TZ, undefined, '2026-10-05')).toMatchObject({
      desde: '2026-10-05',
      hasta: '2026-10-05',
    });
  });

  it('rechaza fechas con otro formato', () => {
    expect(() => resolveDayRange(TZ, '10/10/2026')).toThrow(BadRequestException);
  });

  it('rechaza fechas que no existen en el calendario (30 de febrero, mes 13)', () => {
    expect(() => resolveDayRange(TZ, '2026-02-30')).toThrow(BadRequestException);
    expect(() => resolveDayRange(TZ, '2026-13-01')).toThrow(BadRequestException);
  });

  it('rechaza un rango invertido (desde posterior a hasta)', () => {
    expect(() => resolveDayRange(TZ, '2026-10-10', '2026-10-01')).toThrow(
      'La fecha inicial no puede ser posterior a la final.',
    );
  });

  it('acepta hasta 92 días y rechaza rangos más largos', () => {
    expect(() => resolveDayRange(TZ, '2026-01-01', '2026-04-02')).not.toThrow(); // 92 días
    expect(() => resolveDayRange(TZ, '2026-01-01', '2026-04-03')).toThrow(
      'El rango no puede superar 92 días.',
    );
  });
});
