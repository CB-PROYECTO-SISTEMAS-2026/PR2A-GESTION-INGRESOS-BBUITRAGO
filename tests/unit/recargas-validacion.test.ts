/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA · Validación de los datos de recargas, movimientos y personal (Módulo D)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Que los DTO del Módulo D acepten solo datos correctos y rechacen el resto ANTES de llegar a
 *    la lógica de negocio (y a la base de datos):
 *      - CreateRecargaDto (POST /api/recargas): monto mínimo Bs 10, máximo Bs 1.000, hasta 2
 *        decimales, solo pago en efectivo y la clave anti-recarga-duplicada (idempotencyKey).
 *      - AnularRecargaDto (POST /api/admin/recargas/:id/anular): motivo obligatorio.
 *      - MisMovimientosDto / MovimientosEventoDto (historiales): tipos y estados válidos.
 *      - AsignarPersonalDto (personal del evento): solo el rol RECARGADOR.
 *    Además verifica el signo de los montos que ve el cliente (montoConSigno).
 *
 *  POR QUÉ IMPORTA
 *    - Es dinero en efectivo: un monto negativo, con 3 decimales o fuera de los límites no debe
 *      llegar nunca a la base de datos.
 *    - Evita que el navegador mande campos inventados (p. ej. "saldo" o "operadorId").
 *    - Los mensajes son los que verá el recargador en el celular, por eso se comprueban.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/recargas/dto/recargas.dto.ts
 *    backend/src/modules/recargas/recargas.constants.ts
 *    backend/src/modules/saldo/dto/movimientos.dto.ts
 *    backend/src/modules/saldo/saldo-helpers.ts            (montoConSigno, estadoTemporal)
 *    backend/src/modules/personal-evento/dto/personal-evento.dto.ts
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npx jest unit/recargas-validacion.test.ts   (solo este archivo)
 *    npm run test:unit                           (todas las pruebas unitarias)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos, servidor ni internet.
 *
 *  CÓMO LEER EL RESULTADO
 *    `errores(...)` devuelve la lista de mensajes que respondería la API con un 400. Una lista
 *    vacía significa que el cuerpo es válido.
 *
 *  SI FALLA
 *    Probablemente cambió un DTO, un límite o un mensaje. Si el cambio fue intencional, actualiza
 *    aquí lo esperado; si no, revisa los archivos de "CÓDIGO PROBADO".
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Prisma, TipoTransaccionSaldo } from '@prisma/client';
import { VALIDATION_PIPE_OPTIONS } from '../../backend/src/common/validation/validation-pipe.options';
import {
  AnularRecargaDto,
  CreateRecargaDto,
  FiltroRecargasAdminDto,
} from '../../backend/src/modules/recargas/dto/recargas.dto';
import {
  RECARGA_MAX,
  RECARGA_MIN,
  SALDO_MAX_EVENTO,
} from '../../backend/src/modules/recargas/recargas.constants';
import {
  MisMovimientosDto,
  MovimientosEventoDto,
} from '../../backend/src/modules/saldo/dto/movimientos.dto';
import { estadoTemporal, montoConSigno } from '../../backend/src/modules/saldo/saldo-helpers';
import { AsignarPersonalDto } from '../../backend/src/modules/personal-evento/dto/personal-evento.dto';

const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);

function validar<T>(body: unknown, metatype: new () => T, type: 'body' | 'query' = 'body') {
  return pipe.transform(body, { type, metatype }) as Promise<T>;
}

async function errores(body: unknown, metatype: new () => unknown, type: 'body' | 'query' = 'body') {
  try {
    await validar(body, metatype, type);
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return ((err as BadRequestException).getResponse() as { message: string[] }).message;
  }
}

const UUID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const recarga = (cambios: Record<string, unknown> = {}) => ({
  eventoId: 'evento-1',
  codigo: 'MNL-0001',
  monto: 50,
  metodoPago: 'EFECTIVO',
  idempotencyKey: UUID,
  ...cambios,
});

describe('Límites acordados con el equipo', () => {
  it('mínimo Bs 10 y máximo Bs 1.000 por recarga; saldo máximo Bs 5.000 por evento', () => {
    expect([RECARGA_MIN, RECARGA_MAX, SALDO_MAX_EVENTO]).toEqual([10, 1000, 5000]);
  });
});

describe('CreateRecargaDto (POST /api/recargas)', () => {
  it('acepta una recarga correcta', async () => {
    expect(await errores(recarga(), CreateRecargaDto)).toEqual([]);
  });

  it('convierte el monto "12.50" en número y limpia espacios del código', async () => {
    const dto = await validar(recarga({ monto: '12.50', codigo: '  MNL-0001 ' }), CreateRecargaDto);
    expect(dto.monto).toBe(12.5);
    expect(dto.codigo).toBe('MNL-0001');
  });

  it('el método de pago y la clave anti-duplicado son opcionales', async () => {
    expect(await errores(recarga({ metodoPago: undefined, idempotencyKey: undefined }), CreateRecargaDto)).toEqual([]);
  });

  it.each([
    ['Bs 10 (el mínimo)', 10],
    ['Bs 1.000 (el máximo)', 1000],
    ['Bs 99.99', 99.99],
  ])('acepta %s', async (_caso, monto) => {
    expect(await errores(recarga({ monto }), CreateRecargaDto)).toEqual([]);
  });

  it.each([
    ['menor al mínimo', 9.99, 'El monto mínimo por recarga es Bs 10.'],
    ['cero', 0, 'El monto mínimo por recarga es Bs 10.'],
    ['negativo', -50, 'El monto mínimo por recarga es Bs 10.'],
    ['mayor al máximo', 1000.01, 'El monto máximo por recarga es Bs 1000.'],
    ['con 3 decimales', 10.555, 'Ingresa un monto válido (hasta 2 decimales).'],
    ['texto', 'abc', 'Ingresa un monto válido (hasta 2 decimales).'],
    ['notación científica', '1e3', 'Ingresa un monto válido (hasta 2 decimales).'],
    ['vacío', '', 'Ingresa un monto válido (hasta 2 decimales).'],
  ])('rechaza un monto %s', async (_caso, monto, mensaje) => {
    expect(await errores(recarga({ monto }), CreateRecargaDto)).toEqual([mensaje]);
  });

  it('por ahora solo acepta pago en efectivo', async () => {
    expect(await errores(recarga({ metodoPago: 'TARJETA' }), CreateRecargaDto)).toEqual([
      'Por ahora solo se aceptan pagos en efectivo.',
    ]);
  });

  it('exige el código del cliente (un código de solo espacios cuenta como vacío)', async () => {
    expect(await errores(recarga({ codigo: '   ' }), CreateRecargaDto)).toEqual([
      'Escanea o ingresa el código del cliente.',
    ]);
  });

  it('rechaza campos que no existen, como un saldo o un operador enviados desde el navegador', async () => {
    const msgs = await errores(recarga({ saldo: 9999, operadorId: 'otro' }), CreateRecargaDto);
    expect(msgs).toEqual(
      expect.arrayContaining([
        expect.stringContaining('saldo'),
        expect.stringContaining('operadorId'),
      ]),
    );
  });

  it('rechaza una clave anti-duplicado con caracteres raros o muy corta', async () => {
    expect(await errores(recarga({ idempotencyKey: 'abc' }), CreateRecargaDto)).toEqual([
      'La clave de la recarga no es válida.',
    ]);
    expect(await errores(recarga({ idempotencyKey: `${'a'.repeat(30)}'; DROP` }), CreateRecargaDto)).toEqual([
      'La clave de la recarga no es válida.',
    ]);
  });
});

describe('AnularRecargaDto (POST /api/admin/recargas/:id/anular)', () => {
  it('acepta un motivo y le quita los espacios de los extremos', async () => {
    const dto = await validar({ motivo: '  Monto equivocado  ' }, AnularRecargaDto);
    expect(dto.motivo).toBe('Monto equivocado');
  });

  it('exige un motivo de al menos 5 caracteres', async () => {
    expect(await errores({ motivo: ' ok ' }, AnularRecargaDto)).toEqual([
      'Escribe el motivo de la anulación (mínimo 5 caracteres).',
    ]);
    expect(await errores({}, AnularRecargaDto)).toHaveLength(1);
  });

  it('limita el motivo a 120 caracteres (cabe en la nota de la transacción)', async () => {
    expect(await errores({ motivo: 'x'.repeat(121) }, AnularRecargaDto)).toEqual([
      'El motivo no puede superar 120 caracteres.',
    ]);
  });
});

describe('Filtros de historiales', () => {
  it('MisMovimientosDto exige el evento y acepta solo tipos existentes', async () => {
    expect(await errores({ eventoId: 'e1', tipo: 'RECARGA' }, MisMovimientosDto, 'query')).toEqual([]);
    expect(await errores({ eventoId: 'e1', tipo: '' }, MisMovimientosDto, 'query')).toEqual([]);
    expect(await errores({ tipo: 'RECARGA' }, MisMovimientosDto, 'query')).toEqual(['Selecciona un evento.']);
    expect(await errores({ eventoId: 'e1', tipo: 'REGALO' }, MisMovimientosDto, 'query')).toEqual([
      'Tipo de movimiento no válido.',
    ]);
  });

  it('MovimientosEventoDto valida estado, fechas y página', async () => {
    expect(
      await errores({ estado: 'ANULADA', desde: '2026-10-01', page: '2' }, MovimientosEventoDto, 'query'),
    ).toEqual([]);
    expect(await errores({ estado: 'BORRADA' }, MovimientosEventoDto, 'query')).toEqual(['Estado no válido.']);
    expect(await errores({ desde: '01/10/2026' }, MovimientosEventoDto, 'query')).toEqual([
      'La fecha debe tener el formato AAAA-MM-DD.',
    ]);
  });

  it('FiltroRecargasAdminDto solo filtra por recargas vigentes o anuladas', async () => {
    expect(await errores({ estado: 'COMPLETADA' }, FiltroRecargasAdminDto, 'query')).toEqual([]);
    expect(await errores({ estado: 'PENDIENTE' }, FiltroRecargasAdminDto, 'query')).toHaveLength(1);
  });
});

describe('AsignarPersonalDto (POST /api/admin/eventos/:id/personal)', () => {
  it('solo permite asignar recargadores por ahora', async () => {
    expect(await errores({ usuarioId: 'u1', role: 'RECARGADOR' }, AsignarPersonalDto)).toEqual([]);
    expect(await errores({ usuarioId: 'u1', role: 'ADMIN' }, AsignarPersonalDto)).toEqual([
      'Rol de personal no válido.',
    ]);
    expect(await errores({ usuarioId: '', role: 'RECARGADOR' }, AsignarPersonalDto)).toEqual(['Selecciona un usuario.']);
  });
});

describe('montoConSigno (cómo ve el cliente cada movimiento)', () => {
  const d = (n: number) => new Prisma.Decimal(n);

  it('las recargas suman y las compras y devoluciones restan, sin importar cómo se guardaron', () => {
    expect(montoConSigno(TipoTransaccionSaldo.RECARGA, d(50)).toFixed(2)).toBe('50.00');
    expect(montoConSigno(TipoTransaccionSaldo.COMPRA_PRODUCTO, d(35)).toFixed(2)).toBe('-35.00');
    expect(montoConSigno(TipoTransaccionSaldo.DEVOLUCION, d(20)).toFixed(2)).toBe('-20.00');
    expect(montoConSigno(TipoTransaccionSaldo.COMPRA_PRODUCTO, d(-35)).toFixed(2)).toBe('-35.00');
  });

  it('un ajuste conserva su propio signo (la reversión de una recarga anulada es negativa)', () => {
    expect(montoConSigno(TipoTransaccionSaldo.AJUSTE, d(-50)).toFixed(2)).toBe('-50.00');
    expect(montoConSigno(TipoTransaccionSaldo.AJUSTE, d(5)).toFixed(2)).toBe('5.00');
  });
});

describe('estadoTemporal (tarjetas de "Mis saldos")', () => {
  const TZ = 'America/La_Paz';
  const fecha = (dia: string, horaInicio = '10:00', horaFin = '20:00') => ({
    fecha: new Date(`${dia}T00:00:00.000Z`),
    horaInicio,
    horaFin,
  });
  // 15 de octubre de 2026, 12:00 en La Paz (16:00 UTC).
  const ahora = new Date('2026-10-15T16:00:00.000Z');

  it('EN_CURSO si hoy es día del evento y está dentro del horario', () => {
    expect(estadoTemporal([fecha('2026-10-15')], '2026-10-15', TZ, ahora)).toBe('EN_CURSO');
  });

  it('HOY si hoy es día del evento pero fuera de horario', () => {
    expect(estadoTemporal([fecha('2026-10-15', '19:00', '23:00')], '2026-10-15', TZ, ahora)).toBe('HOY');
  });

  it('PROXIMO si todavía no empezó y FINALIZADO si su último día ya pasó', () => {
    expect(estadoTemporal([fecha('2026-10-20')], '2026-10-15', TZ, ahora)).toBe('PROXIMO');
    expect(estadoTemporal([fecha('2026-10-01'), fecha('2026-10-02')], '2026-10-15', TZ, ahora)).toBe('FINALIZADO');
  });
});
