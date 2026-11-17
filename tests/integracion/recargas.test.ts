/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA DE INTEGRACIÓN · Recargas de saldo, anulaciones, movimientos y personal (Módulo D)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Los servicios reales del Módulo D contra la base de datos real:
 *      1. HU-019 Recarga: el recargador asignado acredita 1:1 el efectivo como saldo del cliente
 *         en el evento, identificándolo por manilla o por QR digital. La primera recarga crea el
 *         saldo del cliente en ese evento.
 *      2. HU-047 Errores: evento no asignado, fuera de horario, códigos inválidos, saldo máximo
 *         por evento (Bs 5.000); reintentos con la misma clave que NO acreditan dos veces (ni
 *         siquiera enviados a la vez); dos recargas simultáneas que no superan el tope.
 *      3. HU-047 Anulación (solo administrador): la recarga queda ANULADA, el saldo vuelve atrás
 *         y queda un AJUSTE negativo con el motivo; no se puede anular dos veces (ni con dos
 *         administradores a la vez) ni si el cliente ya gastó ese saldo.
 *      4. HU-020 Historiales: recargas del recargador (totales del turno), saldos y movimientos
 *         del cliente por evento, movimientos del evento para el organizador y el administrador.
 *      5. Personal del evento: asignar y quitar recargadores; quien no está asignado no recarga.
 *
 *  POR QUÉ IMPORTA
 *    Es dinero en efectivo que entra al sistema. Un error aquí acredita dos veces el mismo
 *    billete, deja recargar a quien no corresponde o permite borrar dinero ya gastado.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/recargas/recargas.service.ts           (contexto, consulta, recarga, historial)
 *    backend/src/modules/recargas/recargas-admin.service.ts     (listado y anulación)
 *    backend/src/modules/saldo/movimientos.service.ts           (saldos y movimientos por evento)
 *    backend/src/modules/saldo/codigo-cliente.service.ts        (identificación por QR o manilla)
 *    backend/src/modules/personal-evento/personal-evento.service.ts
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:integracion                   (todas las de integración, una tras otra)
 *    npx jest --runInBand integracion/recargas  (solo este archivo)
 *
 *  REQUISITOS
 *    - backend/.env y backend/prisma/ca.pem (usa la misma base compartida de Aiven).
 *    - Internet. Tarda alrededor de 2 minutos.
 *
 *  QUÉ DATOS USA
 *    Igual que pos-cobro.test.ts: crea su propio escenario "[PRUEBA-AUTO]" (helpers/escenario.ts)
 *    y lo borra al terminar. El cliente empieza con Bs 100 en el evento abierto; cada prueba que
 *    depende del saldo lo fija antes con setSaldo(). Si se corta, usa `npm run limpiar`.
 *
 *  CÓMO LEER EL RESULTADO
 *    Las pruebas de "Anulación" y "Personal" comparten estado dentro de su bloque y corren en
 *    orden: si una falla, arregla primero la primera que falló.
 *
 *  SI FALLA
 *    - Recarga o tope: revisa recargar() (aumento condicional `saldo <= 5000 - monto`).
 *    - Duplicados: revisa la idempotencyKey (es el id de la transacción) y recargaRegistrada().
 *    - Anulación: revisa anular() (cambio de estado condicional y descuento `saldo >= monto`).
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EstadoTransaccion, Role, TipoTransaccionSaldo } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import type { AuthUser } from '../../backend/src/common/decorators/current-user.decorator';
import { CodigoClienteService } from '../../backend/src/modules/saldo/codigo-cliente.service';
import { MovimientosService } from '../../backend/src/modules/saldo/movimientos.service';
import { RecargasService } from '../../backend/src/modules/recargas/recargas.service';
import { RecargasAdminService } from '../../backend/src/modules/recargas/recargas-admin.service';
import { PersonalEventoService } from '../../backend/src/modules/personal-evento/personal-evento.service';
import { Escenario, crearEscenario, getSaldo, nuevoSufijo, setSaldo } from './helpers/escenario';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba } = require('./helpers/limpieza');

const DOS_HORAS = 2 * 60 * 60 * 1000;
const sufijo = nuevoSufijo();

let prisma: PrismaService;
let esc: Escenario;
let recargas: RecargasService;
let admin: RecargasAdminService;
let movimientos: MovimientosService;
let personal: PersonalEventoService;

async function capturar(promesa: Promise<unknown>): Promise<HttpException> {
  try {
    await promesa;
  } catch (err) {
    return err as HttpException;
  }
  throw new Error('Se esperaba un error y la operación terminó bien.');
}

const cuerpo = (err: HttpException) => {
  const r = err.getResponse();
  return (typeof r === 'string' ? { message: r } : r) as { message: string; code?: string; [k: string]: unknown };
};

/** Recarga en el evento abierto, con la manilla del cliente. */
const recarga = (monto: number, extra: Record<string, unknown> = {}) => ({
  eventoId: esc.eventos.abierto,
  codigo: esc.codigos.manilla,
  monto,
  ...extra,
});

const transaccionesDe = (usuarioId: string, tipo?: TipoTransaccionSaldo) =>
  prisma.transaccionSaldo.findMany({
    where: { usuarioId, eventoId: esc.eventos.abierto, ...(tipo ? { tipo } : {}) },
    orderBy: { createdAt: 'asc' },
  });

const usuario = (id: string, roles: Role[]): AuthUser => ({
  id,
  email: 'prueba@pruebas.eventix.test',
  nombre: 'Prueba',
  apellido: null,
  roles,
});

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  const config = {
    get: (_key: string, fallback?: string) => process.env.APP_TIMEZONE ?? fallback,
  } as unknown as ConfigService;
  recargas = new RecargasService(prisma, config, new CodigoClienteService(prisma));
  admin = new RecargasAdminService(prisma, config);
  movimientos = new MovimientosService(prisma, config);
  personal = new PersonalEventoService(prisma);

  await limpiarDatosPrueba(prisma, { creadosAntesDe: new Date(Date.now() - DOS_HORAS) });
  esc = await crearEscenario(prisma, sufijo);
});

afterAll(async () => {
  if (prisma) {
    await limpiarDatosPrueba(prisma, { sufijo });
    await prisma.$disconnect();
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('HU-019 · Recarga de saldo 1:1', () => {
  beforeEach(() => setSaldo(prisma, esc, 100));

  it('el contexto muestra los eventos asignados (abierto ahora y fuera de horario) y los límites', async () => {
    const ctx = await recargas.contexto(esc.usuarios.recargador);
    expect(ctx.eventos.map((e) => [e.id, e.enCurso])).toEqual([
      [esc.eventos.abierto, true],
      [esc.eventos.cerrado, false],
    ]);
    expect(ctx.limites).toEqual({ minimo: '10.00', maximo: '1000.00', saldoMaximo: '5000.00' });
    expect(ctx.montosRapidos).toEqual(['20.00', '50.00', '100.00', '200.00']);
    expect(ctx.metodosPago).toEqual(['EFECTIVO']);
  });

  it('un recargador sin eventos asignados no ve ningún evento', async () => {
    expect((await recargas.contexto(esc.usuarios.recargador2)).eventos).toEqual([]);
  });

  it('consulta al cliente por su manilla antes de recargar (saldo y cuánto se le puede recargar)', async () => {
    const r = await recargas.consultarCliente(esc.usuarios.recargador, {
      eventoId: esc.eventos.abierto,
      codigo: esc.codigos.manilla,
    });
    expect(r).toMatchObject({
      cliente: { medio: 'MANILLA', identificador: esc.codigos.manilla },
      saldo: '100.00',
      maxRecargable: '1000.00',
    });
  });

  it('acredita la recarga 1:1 y registra quién la hizo y que fue en efectivo', async () => {
    const r = await recargas.recargar(esc.usuarios.recargador, recarga(50));
    expect(r).toMatchObject({
      repetido: false,
      estado: 'COMPLETADA',
      metodoPago: 'EFECTIVO',
      monto: '50.00',
      saldoAnterior: '100.00',
      saldoResultante: '150.00',
      cliente: { medio: 'MANILLA' },
    });
    expect(await getSaldo(prisma, esc)).toBe('150.00');

    const tx = await prisma.transaccionSaldo.findUniqueOrThrow({ where: { id: r.transaccionId } });
    expect(tx).toMatchObject({
      tipo: TipoTransaccionSaldo.RECARGA,
      estado: EstadoTransaccion.COMPLETADA,
      operadorId: esc.usuarios.recargador,
      usuarioId: esc.usuarios.cliente,
      eventoId: esc.eventos.abierto,
      nota: 'Recarga en efectivo',
    });
    expect(tx.monto.toFixed(2)).toBe('50.00');
    expect(tx.saldoResultante.toFixed(2)).toBe('150.00');
  });

  it('también recarga identificando al cliente por el QR de su entrada digital, con centavos', async () => {
    const r = await recargas.recargar(esc.usuarios.recargador, recarga(12.5, { codigo: esc.codigos.qr }));
    expect(r.cliente.medio).toBe('QR_DIGITAL');
    expect(r.saldoResultante).toBe('112.50');
  });

  it('la primera recarga de un cliente sin saldo en el evento crea su saldo', async () => {
    const antes = await prisma.saldoEvento.findUnique({
      where: { usuarioId_eventoId: { usuarioId: esc.usuarios.cliente2, eventoId: esc.eventos.abierto } },
    });
    expect(antes).toBeNull();

    const consulta = await recargas.consultarCliente(esc.usuarios.recargador, {
      eventoId: esc.eventos.abierto,
      codigo: esc.codigos.qrCliente2,
    });
    expect(consulta.saldo).toBe('0.00');

    const r = await recargas.recargar(esc.usuarios.recargador, recarga(20, { codigo: esc.codigos.qrCliente2 }));
    expect(r).toMatchObject({ saldoAnterior: '0.00', saldoResultante: '20.00' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('HU-047 · Validaciones y errores de la recarga', () => {
  beforeEach(() => setSaldo(prisma, esc, 100));

  it('rechaza a un recargador que no está asignado al evento', async () => {
    const err = await capturar(recargas.recargar(esc.usuarios.recargador2, recarga(50)));
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(cuerpo(err).message).toBe('No estás asignado como recargador en este evento.');
    expect(await getSaldo(prisma, esc)).toBe('100.00');
  });

  it('rechaza recargar fuera del horario del evento', async () => {
    const err = await capturar(
      recargas.recargar(esc.usuarios.recargador, {
        eventoId: esc.eventos.cerrado,
        codigo: esc.codigos.entradaOtroEvento,
        monto: 50,
      }),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(cuerpo(err).message).toBe(`El evento está cerrado en este momento. Horario de hoy: ${esc.horarioCerrado}.`);
  });

  it.each([
    ['un código de otro evento', 'entradaOtroEvento', BadRequestException, 'Este código pertenece a otro evento.'],
    ['una entrada anulada', 'entradaAnulada', BadRequestException, 'La entrada está anulada o fue reembolsada.'],
    ['una manilla sin vincular', 'manillaSinVincular', BadRequestException, 'Esta manilla todavía no está vinculada a una entrada.'],
  ] as const)('rechaza %s', async (_caso, codigo, tipo, mensaje) => {
    const err = await capturar(recargas.recargar(esc.usuarios.recargador, recarga(50, { codigo: esc.codigos[codigo] })));
    expect(err).toBeInstanceOf(tipo);
    expect(cuerpo(err).message).toBe(mensaje);
  });

  it('rechaza un código que no existe', async () => {
    const err = await capturar(recargas.recargar(esc.usuarios.recargador, recarga(50, { codigo: 'NO-EXISTE-123' })));
    expect(err).toBeInstanceOf(NotFoundException);
  });

  it('no deja superar el saldo máximo de Bs 5.000 por evento y no registra nada', async () => {
    await setSaldo(prisma, esc, 4990);
    const antes = (await transaccionesDe(esc.usuarios.cliente)).length;

    const consulta = await recargas.consultarCliente(esc.usuarios.recargador, {
      eventoId: esc.eventos.abierto,
      codigo: esc.codigos.manilla,
    });
    expect(consulta.maxRecargable).toBe('10.00');

    const err = await capturar(recargas.recargar(esc.usuarios.recargador, recarga(20)));
    expect(err).toBeInstanceOf(ConflictException);
    expect(cuerpo(err)).toMatchObject({ code: 'SALDO_MAXIMO', saldo: '4990.00', maxRecargable: '10.00' });
    expect(await getSaldo(prisma, esc)).toBe('4990.00');
    expect((await transaccionesDe(esc.usuarios.cliente)).length).toBe(antes);

    // Justo hasta el tope sí se puede.
    const ok = await recargas.recargar(esc.usuarios.recargador, recarga(10));
    expect(ok.saldoResultante).toBe('5000.00');
  });

  it('dos recargas simultáneas no superan el tope entre las dos', async () => {
    await setSaldo(prisma, esc, 4900);
    const resultados = await Promise.allSettled([
      recargas.recargar(esc.usuarios.recargador, recarga(60)),
      recargas.recargar(esc.usuarios.recargador, recarga(60)),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazo = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(cuerpo(rechazo.reason).code).toBe('SALDO_MAXIMO');
    expect(await getSaldo(prisma, esc)).toBe('4960.00');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('HU-047 · Reintentos sin recargas duplicadas', () => {
  beforeEach(() => setSaldo(prisma, esc, 100));

  it('un reintento con la misma clave devuelve la recarga original y no acredita otra vez', async () => {
    const clave = randomUUID();
    const primera = await recargas.recargar(esc.usuarios.recargador, recarga(30, { idempotencyKey: clave }));
    const segunda = await recargas.recargar(esc.usuarios.recargador, recarga(30, { idempotencyKey: clave }));

    expect(primera.repetido).toBe(false);
    expect(segunda).toMatchObject({ repetido: true, transaccionId: clave, saldoResultante: '130.00' });
    expect(await getSaldo(prisma, esc)).toBe('130.00');
    expect(await prisma.transaccionSaldo.count({ where: { id: clave } })).toBe(1);
  });

  it('dos envíos SIMULTÁNEOS con la misma clave acreditan una sola vez', async () => {
    const clave = randomUUID();
    const resultados = await Promise.all([
      recargas.recargar(esc.usuarios.recargador, recarga(40, { idempotencyKey: clave })),
      recargas.recargar(esc.usuarios.recargador, recarga(40, { idempotencyKey: clave })),
    ]);
    expect(resultados.map((r) => r.repetido).sort()).toEqual([false, true]);
    expect(await getSaldo(prisma, esc)).toBe('140.00');
  });

  it('una clave ya usada por otro recargador se rechaza', async () => {
    const clave = randomUUID();
    await recargas.recargar(esc.usuarios.recargador, recarga(10, { idempotencyKey: clave }));
    // Se asigna temporalmente al segundo recargador para que el rechazo sea por la clave.
    await prisma.staffEvento.create({
      data: { usuarioId: esc.usuarios.recargador2, eventoId: esc.eventos.abierto, role: Role.RECARGADOR },
    });
    try {
      const err = await capturar(recargas.recargar(esc.usuarios.recargador2, recarga(10, { idempotencyKey: clave })));
      expect(err).toBeInstanceOf(ConflictException);
      expect(cuerpo(err).message).toBe('La clave de esta recarga ya fue utilizada.');
    } finally {
      await prisma.staffEvento.deleteMany({
        where: { usuarioId: esc.usuarios.recargador2, eventoId: esc.eventos.abierto },
      });
    }
    expect(await getSaldo(prisma, esc)).toBe('110.00');
  });

  it('el id de otro tipo de movimiento (p. ej. un ajuste) no sirve como clave de recarga', async () => {
    const saldo = await prisma.saldoEvento.findUniqueOrThrow({
      where: { usuarioId_eventoId: { usuarioId: esc.usuarios.cliente, eventoId: esc.eventos.abierto } },
    });
    const ajuste = await prisma.transaccionSaldo.create({
      data: {
        saldoEventoId: saldo.id,
        usuarioId: esc.usuarios.cliente,
        eventoId: esc.eventos.abierto,
        tipo: TipoTransaccionSaldo.AJUSTE,
        monto: 0,
        saldoResultante: 100,
        nota: 'Movimiento de prueba',
      },
    });
    try {
      const err = await capturar(recargas.recargar(esc.usuarios.recargador, recarga(10, { idempotencyKey: ajuste.id })));
      expect(err).toBeInstanceOf(ConflictException);
      expect(await getSaldo(prisma, esc)).toBe('100.00');
    } finally {
      await prisma.transaccionSaldo.delete({ where: { id: ajuste.id } });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('HU-047 · Anulación de recargas por el administrador', () => {
  let recargaId: string;

  it('anula una recarga: queda ANULADA, el saldo vuelve atrás y queda un AJUSTE negativo', async () => {
    await setSaldo(prisma, esc, 100);
    const r = await recargas.recargar(esc.usuarios.recargador, recarga(200));
    recargaId = r.transaccionId;
    expect(await getSaldo(prisma, esc)).toBe('300.00');

    const res = await admin.anular(esc.usuarios.admin, recargaId, 'Se recargó 200 en lugar de 20');
    expect(res).toMatchObject({ estado: 'ANULADA', montoRevertido: '200.00', saldoResultante: '100.00' });
    expect(await getSaldo(prisma, esc)).toBe('100.00');

    const original = await prisma.transaccionSaldo.findUniqueOrThrow({ where: { id: recargaId } });
    expect(original.estado).toBe(EstadoTransaccion.ANULADA);
    expect(original.nota).toBe('Recarga en efectivo · Anulada: Se recargó 200 en lugar de 20');

    const ajuste = await prisma.transaccionSaldo.findUniqueOrThrow({ where: { id: res.ajuste.id } });
    expect(ajuste).toMatchObject({ tipo: TipoTransaccionSaldo.AJUSTE, operadorId: esc.usuarios.admin });
    expect(ajuste.monto.toFixed(2)).toBe('-200.00');
    expect(ajuste.saldoResultante.toFixed(2)).toBe('100.00');
    expect(ajuste.nota).toContain(res.codigo);
  });

  it('no se puede anular dos veces', async () => {
    const err = await capturar(admin.anular(esc.usuarios.admin, recargaId, 'Otra vez'));
    expect(err).toBeInstanceOf(ConflictException);
    expect(cuerpo(err).message).toBe('Esta recarga ya fue anulada.');
    expect(await getSaldo(prisma, esc)).toBe('100.00');
  });

  it('dos administradores anulando a la vez: solo uno lo consigue y el saldo baja una vez', async () => {
    await setSaldo(prisma, esc, 100);
    const r = await recargas.recargar(esc.usuarios.recargador, recarga(50));
    const resultados = await Promise.allSettled([
      admin.anular(esc.usuarios.admin, r.transaccionId, 'Anulación A'),
      admin.anular(esc.usuarios.admin, r.transaccionId, 'Anulación B'),
    ]);
    expect(resultados.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await getSaldo(prisma, esc)).toBe('100.00');
    expect(await prisma.transaccionSaldo.count({ where: { nota: { contains: r.codigo } } })).toBe(1);
  });

  it('no se puede anular si el cliente ya gastó ese saldo (y no cambia nada)', async () => {
    await setSaldo(prisma, esc, 0);
    const r = await recargas.recargar(esc.usuarios.recargador, recarga(80));
    await setSaldo(prisma, esc, 30); // El cliente gastó 50 en el POS.

    const err = await capturar(admin.anular(esc.usuarios.admin, r.transaccionId, 'Monto equivocado'));
    expect(err).toBeInstanceOf(ConflictException);
    expect(cuerpo(err)).toMatchObject({ code: 'SALDO_YA_USADO', saldo: '30.00', monto: '80.00' });

    const tx = await prisma.transaccionSaldo.findUniqueOrThrow({ where: { id: r.transaccionId } });
    expect(tx.estado).toBe(EstadoTransaccion.COMPLETADA);
    expect(await getSaldo(prisma, esc)).toBe('30.00');
  });

  it('solo se anulan recargas existentes', async () => {
    expect(await capturar(admin.anular(esc.usuarios.admin, 'no-existe', 'Motivo cualquiera'))).toBeInstanceOf(
      NotFoundException,
    );
    const ajuste = await prisma.transaccionSaldo.findFirstOrThrow({
      where: { eventoId: esc.eventos.abierto, tipo: TipoTransaccionSaldo.AJUSTE },
    });
    const err = await capturar(admin.anular(esc.usuarios.admin, ajuste.id, 'Motivo cualquiera'));
    expect(err).toBeInstanceOf(BadRequestException);
    expect(cuerpo(err).message).toBe('Solo se pueden anular recargas.');
  });

  it('el listado del administrador filtra por evento y estado', async () => {
    const anuladas = await admin.listar({ eventoId: esc.eventos.abierto, estado: 'ANULADA' });
    expect(anuladas.recargas.length).toBeGreaterThanOrEqual(2);
    expect(anuladas.recargas.every((r) => r.estado === 'ANULADA')).toBe(true);
    expect(anuladas.totalRecargado).toBe('0.00');

    const todas = await admin.listar({ eventoId: esc.eventos.abierto });
    expect(todas.recargas.every((r) => r.evento.includes(esc.sufijo.toUpperCase()))).toBe(true);
    expect(todas.recargas[0].recargador).toBe('Prueba recargador Auto');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('HU-020 · Historiales', () => {
  it('el recargador ve sus recargas de hoy con el efectivo cobrado (sin contar las anuladas)', async () => {
    const h = await recargas.misRecargas(esc.usuarios.recargador, {});
    const vigentes = h.recargas.filter((r) => r.estado === 'COMPLETADA');
    const suma = vigentes.reduce((acc, r) => acc + Number(r.monto), 0);
    expect(h.cantidad).toBe(vigentes.length);
    expect(Number(h.total)).toBeCloseTo(suma, 2);
    expect(h.anuladas).toBeGreaterThanOrEqual(2);
    expect(h.recargas.every((r) => r.evento.includes(esc.sufijo.toUpperCase()))).toBe(true);
  });

  it('otro recargador no ve las recargas ajenas', async () => {
    const h = await recargas.misRecargas(esc.usuarios.recargador2, {});
    expect(h.recargas).toEqual([]);
    expect(h.total).toBe('0.00');
  });

  it('el cliente ve su saldo por evento en "Mis saldos"', async () => {
    await setSaldo(prisma, esc, 75);
    const { saldos } = await movimientos.misSaldos(esc.usuarios.cliente);
    const abierto = saldos.find((s) => s.eventoId === esc.eventos.abierto);
    const cerrado = saldos.find((s) => s.eventoId === esc.eventos.cerrado);
    expect(abierto).toMatchObject({ saldo: '75.00', momento: 'EN_CURSO' });
    // Tiene entrada en el evento fuera de horario pero nunca recargó: aparece con saldo 0.
    expect(cerrado).toMatchObject({ saldo: '0.00', momento: 'HOY' });
  });

  it('el cliente ve sus movimientos del evento con el signo correcto, del más reciente al más antiguo', async () => {
    const m = await movimientos.misMovimientos(esc.usuarios.cliente, { eventoId: esc.eventos.abierto });
    expect(m.evento.id).toBe(esc.eventos.abierto);
    const fechas = m.movimientos.map((x) => new Date(x.fecha).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    for (const x of m.movimientos) {
      if (x.tipo === 'RECARGA') expect(Number(x.monto)).toBeGreaterThanOrEqual(0);
    }
    expect(m.movimientos.some((x) => x.tipo === 'AJUSTE' && Number(x.monto) < 0)).toBe(true);
    expect(m.movimientos.some((x) => x.estado === 'ANULADA')).toBe(true);
  });

  it('el filtro por tipo solo devuelve ese tipo', async () => {
    const m = await movimientos.misMovimientos(esc.usuarios.cliente, {
      eventoId: esc.eventos.abierto,
      tipo: TipoTransaccionSaldo.AJUSTE,
    });
    expect(m.movimientos.length).toBeGreaterThan(0);
    expect(m.movimientos.every((x) => x.tipo === 'AJUSTE')).toBe(true);
  });

  it('un cliente no ve los movimientos de otro', async () => {
    const m = await movimientos.misMovimientos(esc.usuarios.cliente2, { eventoId: esc.eventos.abierto });
    const propios = await transaccionesDe(esc.usuarios.cliente2);
    expect(m.movimientos.map((x) => x.id).sort()).toEqual(propios.map((t) => t.id).sort());
  });

  it('el organizador del evento y el administrador ven los movimientos del evento; otro organizador no', async () => {
    const delOrganizador = await movimientos.movimientosEvento(
      usuario(esc.usuarios.organizador, [Role.ORGANIZADOR]),
      esc.eventos.abierto,
      {},
    );
    expect(delOrganizador.totalItems).toBeGreaterThan(0);
    expect(Number(delOrganizador.totales.RECARGA.monto)).toBeGreaterThan(0);
    expect(Number(delOrganizador.totales.AJUSTE.monto)).toBeLessThan(0);

    const delAdmin = await movimientos.movimientosEvento(usuario(esc.usuarios.admin, [Role.ADMIN]), esc.eventos.abierto, {
      tipo: TipoTransaccionSaldo.RECARGA,
    });
    expect(delAdmin.movimientos.every((x) => x.tipo === 'RECARGA')).toBe(true);

    const err = await capturar(
      movimientos.movimientosEvento(usuario(esc.usuarios.organizador2, [Role.ORGANIZADOR]), esc.eventos.abierto, {}),
    );
    expect(err).toBeInstanceOf(ForbiddenException);
  });

  it('el filtro de estado cambia la lista pero no los totales (que suman solo lo completado)', async () => {
    const yo = usuario(esc.usuarios.admin, [Role.ADMIN]);
    const todos = await movimientos.movimientosEvento(yo, esc.eventos.abierto, {});
    const anulados = await movimientos.movimientosEvento(yo, esc.eventos.abierto, { estado: EstadoTransaccion.ANULADA });
    expect(anulados.movimientos.length).toBeGreaterThan(0);
    expect(anulados.movimientos.every((x) => x.estado === 'ANULADA')).toBe(true);
    expect(anulados.totales).toEqual(todos.totales);
  });

  it('el saldo en circulación del evento es la suma de los saldos de sus clientes', async () => {
    const m = await movimientos.movimientosEvento(usuario(esc.usuarios.admin, [Role.ADMIN]), esc.eventos.abierto, {});
    const suma = await prisma.saldoEvento.aggregate({ where: { eventoId: esc.eventos.abierto }, _sum: { saldo: true } });
    expect(m.saldoEnCirculacion).toBe(suma._sum.saldo!.toFixed(2));
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('Personal del evento (asignación de recargadores)', () => {
  let asignacionId: string;

  it('los candidatos son usuarios con rol RECARGADOR que aún no están asignados', async () => {
    const { candidatos } = await personal.candidatos(esc.eventos.abierto, {
      role: Role.RECARGADOR,
      q: `recargador2.${esc.sufijo}`,
    });
    expect(candidatos.map((c) => c.id)).toEqual([esc.usuarios.recargador2]);

    const yaAsignado = await personal.candidatos(esc.eventos.abierto, {
      role: Role.RECARGADOR,
      q: `recargador.${esc.sufijo}`,
    });
    expect(yaAsignado.candidatos).toEqual([]);
  });

  it('asigna un recargador al evento y desde ese momento puede recargar', async () => {
    await setSaldo(prisma, esc, 100);
    const { personal: lista } = await personal.asignar(esc.eventos.abierto, {
      usuarioId: esc.usuarios.recargador2,
      role: Role.RECARGADOR,
    });
    const fila = lista.find((p) => p.usuario.id === esc.usuarios.recargador2);
    expect(fila).toBeDefined();
    asignacionId = fila!.id;

    const r = await recargas.recargar(esc.usuarios.recargador2, recarga(10));
    expect(r.saldoResultante).toBe('110.00');
  });

  it('no asigna a un usuario que no tiene el rol de recargador', async () => {
    const err = await capturar(
      personal.asignar(esc.eventos.abierto, { usuarioId: esc.usuarios.cliente, role: Role.RECARGADOR }),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(cuerpo(err).message).toBe('El usuario no tiene el rol que se quiere asignar.');
  });

  it('al quitarlo deja de poder recargar, y se puede volver a asignar', async () => {
    const { personal: lista } = await personal.quitar(esc.eventos.abierto, asignacionId);
    expect(lista.some((p) => p.id === asignacionId)).toBe(false);
    expect(await capturar(recargas.recargar(esc.usuarios.recargador2, recarga(10)))).toBeInstanceOf(ForbiddenException);

    // Quitar dos veces la misma asignación no existe.
    expect(await capturar(personal.quitar(esc.eventos.abierto, asignacionId))).toBeInstanceOf(NotFoundException);

    // Reasignar reactiva la misma fila (no duplica).
    await personal.asignar(esc.eventos.abierto, { usuarioId: esc.usuarios.recargador2, role: Role.RECARGADOR });
    expect(
      await prisma.staffEvento.count({ where: { usuarioId: esc.usuarios.recargador2, eventoId: esc.eventos.abierto } }),
    ).toBe(1);
  });
});
