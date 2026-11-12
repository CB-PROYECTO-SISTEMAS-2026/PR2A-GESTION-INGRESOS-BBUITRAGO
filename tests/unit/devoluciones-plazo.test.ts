/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA · Plazo de 30 días y datos de la devolución de saldo (Sprint 3, Módulo A)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    1. fechaFinEvento(): el instante en que termina un evento es el cierre (horaFin) de su
 *       último día; si ese horario cruza la medianoche, termina la madrugada siguiente.
 *    2. calcularPlazoRetiro(): el cliente puede retirar su saldo hasta el final del día 30
 *       contado desde el día en que terminó el evento (hora de La Paz); después, vencido.
 *    3. CreateDevolucionDto (POST /api/devoluciones): monto esperado positivo con 2 decimales,
 *       identidad verificada obligatoria y clave anti-devolución-duplicada.
 *    4. AsignarPersonalDto: ahora también acepta el rol DEVOLUCIONES.
 *
 *  POR QUÉ IMPORTA
 *    - La regla de los 30 días la comparten la devolución (Módulo A), los dashboards (Módulo B)
 *      y el historial del cliente (Módulo D): si se calcula mal, a un cliente se le niega su
 *      dinero un día antes o se le paga cuando ya no corresponde.
 *    - Bolivia está en UTC-4: un cálculo en UTC correría el límite un día.
 *    - Es efectivo: nunca se debe devolver sin que el encargado confirme la identidad.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/saldo/plazo-retiro.ts
 *    backend/src/modules/devoluciones/dto/devoluciones.dto.ts
 *    backend/src/modules/personal-evento/dto/personal-evento.dto.ts
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npx jest unit/devoluciones-plazo.test.ts   (solo este archivo)
 *    npm run test:unit                          (todas las pruebas unitarias)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, servidor ni internet. Tampoco depende de la hora real de la
 *    máquina: cada caso fija el instante exacto que quiere probar.
 *
 *  CÓMO LEER EL RESULTADO
 *    Cada `it(...)` describe una regla en español. Recuerda: La Paz = UTC-4, así que las 22:00
 *    de La Paz son las 02:00 UTC del día siguiente.
 *
 *  SI FALLA
 *    Alguien cambió la regla del plazo o el DTO. Si el cambio fue intencional (p. ej. otro número
 *    de días), actualiza aquí lo esperado y avisa a los módulos B y D, que usan la misma función.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../backend/src/common/validation/validation-pipe.options';
import { CreateDevolucionDto } from '../../backend/src/modules/devoluciones/dto/devoluciones.dto';
import { AsignarPersonalDto } from '../../backend/src/modules/personal-evento/dto/personal-evento.dto';
import {
  PLAZO_RETIRO_DIAS,
  calcularPlazoRetiro,
  fechaFinEvento,
  plazoRetiroEvento,
} from '../../backend/src/modules/saldo/plazo-retiro';

const TZ = 'America/La_Paz';

/** Día del evento como lo guarda Prisma (columna DATE = medianoche UTC). */
const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);

/** Instante a partir de la hora local de La Paz (UTC-4, sin horario de verano). */
const laPaz = (fecha: string, hora: string) =>
  new Date(new Date(`${fecha}T${hora}:00.000Z`).getTime() + 4 * 3600_000);

const fecha = (d: string, horaInicio = '10:00', horaFin = '20:00') => ({
  fecha: dia(d),
  horaInicio,
  horaFin,
});

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

async function errores(body: unknown, metatype: new () => unknown) {
  try {
    await pipe.transform(body, { type: 'body', metatype });
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return ((err as BadRequestException).getResponse() as { message: string[] }).message;
  }
}

describe('fechaFinEvento: cuándo termina el evento', () => {
  it('es el cierre del último día, en hora de La Paz', () => {
    const fin = fechaFinEvento([fecha('2026-12-05'), fecha('2026-12-07'), fecha('2026-12-06')], TZ);
    expect(fin).toEqual(laPaz('2026-12-07', '20:00'));
  });

  it('si el horario cruza la medianoche, termina la madrugada del día siguiente', () => {
    const fin = fechaFinEvento([fecha('2026-12-05', '20:00', '02:00')], TZ);
    expect(fin).toEqual(laPaz('2026-12-06', '02:00'));
  });

  it('un evento sin fechas no tiene fin (null)', () => {
    expect(fechaFinEvento([], TZ)).toBeNull();
    expect(plazoRetiroEvento([], TZ)).toBeNull();
  });
});

describe('calcularPlazoRetiro: 30 días desde el fin del evento', () => {
  const fin = laPaz('2026-12-07', '20:00');

  it(`el límite es el día ${PLAZO_RETIRO_DIAS} después del día en que terminó`, () => {
    expect(PLAZO_RETIRO_DIAS).toBe(30);
    expect(calcularPlazoRetiro(fin, TZ, laPaz('2026-12-08', '09:00')).fechaLimite).toBe('2027-01-06');
  });

  it('durante el evento todavía no vence (se puede devolver mientras ocurre)', () => {
    const p = calcularPlazoRetiro(fin, TZ, laPaz('2026-12-07', '15:00'));
    expect(p.vencido).toBe(false);
    expect(p.diasRestantes).toBe(31);
  });

  it('el último día del plazo, hasta las 23:59 de La Paz, todavía se puede', () => {
    const p = calcularPlazoRetiro(fin, TZ, laPaz('2027-01-06', '23:59'));
    expect(p.vencido).toBe(false);
    expect(p.diasRestantes).toBe(1);
  });

  it('a las 00:00 del día siguiente al límite ya venció', () => {
    const p = calcularPlazoRetiro(fin, TZ, laPaz('2027-01-07', '00:00'));
    expect(p.vencido).toBe(true);
    expect(p.diasRestantes).toBe(0);
    expect(p.venceAt).toEqual(laPaz('2027-01-07', '00:00'));
  });

  it('usa el día de La Paz y no el de UTC (un cierre a las 22:00 sigue siendo ese día)', () => {
    // 22:00 de La Paz = 02:00 UTC del día 8; el plazo cuenta desde el 7.
    const p = calcularPlazoRetiro(laPaz('2026-12-07', '22:00'), TZ, laPaz('2026-12-08', '09:00'));
    expect(p.fechaLimite).toBe('2027-01-06');
  });

  it('con horario hasta la madrugada, el plazo cuenta desde el día en que de verdad terminó', () => {
    const p = plazoRetiroEvento([fecha('2026-12-07', '20:00', '02:00')], TZ, laPaz('2026-12-10', '12:00'));
    expect(p?.fechaLimite).toBe('2027-01-07');
  });
});

describe('CreateDevolucionDto: datos de la devolución', () => {
  const valido = {
    eventoId: 'evento-1',
    codigo: ' MANILLA-1 ',
    montoEsperado: 120.5,
    identidadVerificada: true,
    idempotencyKey: 'clave-de-prueba-0000000001',
  };

  it('acepta una devolución completa', async () => {
    expect(await errores(valido, CreateDevolucionDto)).toEqual([]);
  });

  it('exige que el encargado confirme la identidad de la persona', async () => {
    const sinVerificar = await errores({ ...valido, identidadVerificada: false }, CreateDevolucionDto);
    expect(sinVerificar).toContain(
      'Confirma que verificaste la identidad de la persona antes de devolver el saldo.',
    );
    const { identidadVerificada: _omitido, ...sinCampo } = valido;
    expect(await errores(sinCampo, CreateDevolucionDto)).toHaveLength(1);
    // Solo vale el booleano: la conversión implícita global convertiría "false" en true.
    expect(await errores({ ...valido, identidadVerificada: 'false' }, CreateDevolucionDto)).toHaveLength(1);
    expect(await errores({ ...valido, identidadVerificada: 'true' }, CreateDevolucionDto)).toHaveLength(1);
    expect(await errores({ ...valido, identidadVerificada: 1 }, CreateDevolucionDto)).toHaveLength(1);
  });

  it('rechaza montos en cero, negativos o con más de 2 decimales', async () => {
    expect(await errores({ ...valido, montoEsperado: 0 }, CreateDevolucionDto)).toEqual([
      'El cliente no tiene saldo para devolver.',
    ]);
    expect(await errores({ ...valido, montoEsperado: -5 }, CreateDevolucionDto)).toHaveLength(1);
    expect(await errores({ ...valido, montoEsperado: 1.005 }, CreateDevolucionDto)).toEqual([
      'Ingresa un monto válido (hasta 2 decimales).',
    ]);
    expect(await errores({ ...valido, montoEsperado: 'abc' }, CreateDevolucionDto)).toEqual([
      'Ingresa un monto válido (hasta 2 decimales).',
    ]);
  });

  it('acepta el monto como texto con 2 decimales (como lo manda la API)', async () => {
    expect(await errores({ ...valido, montoEsperado: '120.50' }, CreateDevolucionDto)).toEqual([]);
  });

  it('rechaza claves de idempotencia mal formadas y campos inventados', async () => {
    expect(await errores({ ...valido, idempotencyKey: 'corta' }, CreateDevolucionDto)).toEqual([
      'La clave de la devolución no es válida.',
    ]);
    expect(await errores({ ...valido, saldoResultante: 0 }, CreateDevolucionDto)).toHaveLength(1);
  });

  it('exige el código escaneado', async () => {
    expect(await errores({ ...valido, codigo: '   ' }, CreateDevolucionDto)).toEqual([
      'Escanea o ingresa el código del cliente.',
    ]);
  });
});

describe('AsignarPersonalDto: roles por evento', () => {
  it('acepta recargadores y encargados de devoluciones, y nada más', async () => {
    expect(await errores({ usuarioId: 'u1', role: 'DEVOLUCIONES' }, AsignarPersonalDto)).toEqual([]);
    expect(await errores({ usuarioId: 'u1', role: 'RECARGADOR' }, AsignarPersonalDto)).toEqual([]);
    expect(await errores({ usuarioId: 'u1', role: 'ADMIN' }, AsignarPersonalDto)).toEqual([
      'Rol de personal no válido.',
    ]);
  });
});
