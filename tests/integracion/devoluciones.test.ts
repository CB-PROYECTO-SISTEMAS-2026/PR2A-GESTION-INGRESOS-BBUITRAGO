/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA DE INTEGRACIÓN · Devolución de saldo en efectivo (Sprint 3, Módulo A)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Los servicios reales del Módulo A contra la base de datos real:
 *      1. HU-026 Identificación: el encargado asignado escanea la manilla o el QR digital y el
 *         sistema identifica al titular, con la foto de su primer ingreso y su documento.
 *      2. HU-027 Consulta: muestra el saldo del cliente en ese evento y cuánto puede retirar
 *         según el plazo (todo el saldo, o nada si el plazo de 30 días venció).
 *      3. HU-028 Devolución: deja el saldo en cero y registra una transacción DEVOLUCION con el
 *         encargado y el evento. Durante el evento y hasta 30 días después (también en eventos
 *         cancelados); vencido el plazo, se rechaza.
 *      4. Seguridad del dinero: nunca se devuelve dos veces (reintentos con la misma clave, dos
 *         encargados a la vez) ni un monto distinto al saldo real.
 *      5. Personal: el encargado de devoluciones se puede asignar a eventos ya terminados.
 *
 *  POR QUÉ IMPORTA
 *    Es dinero en efectivo que sale de la caja. Un error aquí paga dos veces, paga a quien no
 *    corresponde o paga un saldo que ya venció.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/devoluciones/devoluciones.service.ts
 *    backend/src/modules/saldo/plazo-retiro.ts
 *    backend/src/modules/saldo/codigo-cliente.service.ts      (identificación por QR o manilla)
 *    backend/src/modules/saldo/movimientos.service.ts         (la devolución en "Mis saldos")
 *    backend/src/modules/personal-evento/personal-evento.service.ts
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm run test:integracion                       (todas las de integración, una tras otra)
 *    npx jest --runInBand integracion/devoluciones  (solo este archivo)
 *
 *  REQUISITOS
 *    - backend/.env y backend/prisma/ca.pem (usa la misma base compartida de Aiven).
 *    - Internet. Tarda alrededor de 1 minuto.
 *
 *  QUÉ DATOS USA
 *    El escenario "[PRUEBA-AUTO]" de helpers/escenario.ts (el cliente empieza con Bs 100 en el
 *    evento abierto de hoy) más tres eventos pasados propios de esta prueba: uno finalizado hace
 *    5 días, uno cancelado hace 3 días y uno finalizado hace 40 días (plazo vencido), cada uno con
 *    una manilla y saldo del cliente. Todo se borra al terminar; si se corta, `npm run limpiar`.
 *
 *  CÓMO LEER EL RESULTADO
 *    Cada prueba que depende del saldo lo fija antes con setSaldo(), así se pueden correr sueltas.
 *
 *  SI FALLA
 *    - Pagos dobles: revisa devolver() (puesta en cero condicional `saldo = montoEsperado`) y
 *      devolucionRegistrada() (la idempotencyKey es el id de la transacción).
 *    - Plazo: revisa plazo-retiro.ts y requireEventoAsignado().
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventoEstado, Role, TipoTransaccionSaldo } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import { CodigoClienteService } from '../../backend/src/modules/saldo/codigo-cliente.service';
import { MovimientosService } from '../../backend/src/modules/saldo/movimientos.service';
import { DevolucionesService } from '../../backend/src/modules/devoluciones/devoluciones.service';
import { PersonalEventoService } from '../../backend/src/modules/personal-evento/personal-evento.service';
import {
  Escenario,
  crearEscenario,
  crearUsuario,
  diaLaPaz,
  getSaldo,
  nuevoSufijo,
  setSaldo,
} from './helpers/escenario';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba, MARCA } = require('./helpers/limpieza');

const DOS_HORAS = 2 * 60 * 60 * 1000;
const FOTO_URL = 'https://res.cloudinary.com/pruebas/image/upload/prueba-auto-primer-ingreso.jpg';
const sufijo = nuevoSufijo();

let prisma: PrismaService;
let esc: Escenario;
let devoluciones: DevolucionesService;
let movimientos: MovimientosService;
let personal: PersonalEventoService;
let encargado: string;
/** Encargado de devoluciones sin ningún evento asignado. */
let encargado2: string;

interface EventoPasado {
  id: string;
  manilla: string;
}
let pasados: { enPlazo: EventoPasado; cancelado: EventoPasado; vencido: EventoPasado };

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

/** Devolución en el evento abierto, con la manilla del cliente. */
const devolucion = (montoEsperado: number, extra: Record<string, unknown> = {}) => ({
  eventoId: esc.eventos.abierto,
  codigo: esc.codigos.manilla,
  montoEsperado,
  identidadVerificada: true as const,
  ...extra,
});

const devolucionesDe = (eventoId: string) =>
  prisma.transaccionSaldo.findMany({
    where: { usuarioId: esc.usuarios.cliente, eventoId, tipo: TipoTransaccionSaldo.DEVOLUCION },
    orderBy: { createdAt: 'asc' },
  });

const saldoEn = async (eventoId: string) => {
  const s = await prisma.saldoEvento.findUniqueOrThrow({
    where: { usuarioId_eventoId: { usuarioId: esc.usuarios.cliente, eventoId } },
    select: { saldo: true },
  });
  return s.saldo.toFixed(2);
};

/**
 * Evento que ya ocurrió (hace `diasAtras` días, de 10:00 a 20:00) con una manilla vinculada a una
 * entrada del cliente y Bs 80 de saldo.
 */
async function crearEventoPasado(titulo: string, estado: EventoEstado, diasAtras: number): Promise<EventoPasado> {
  const S = sufijo.toUpperCase();
  const manilla = `PRUEBA-AUTO-${S}-DEV-${diasAtras}`;
  const evento = await prisma.evento.create({
    data: {
      titulo: `${MARCA} ${titulo} ${S}`,
      descripcion: 'Evento pasado creado por las pruebas automatizadas.',
      ubicacion: 'Pruebas automatizadas',
      tipoAcceso: 'MANILLA',
      estado,
      organizadorId: esc.usuarios.organizador,
      fechas: {
        create: [{ fecha: new Date(`${diaLaPaz(diasAtras)}T00:00:00.000Z`), horaInicio: '10:00', horaFin: '20:00' }],
      },
      categorias: { create: [{ nombre: 'General', precio: 50, cupo: 10 }] },
    },
    select: { id: true, categorias: { select: { id: true } } },
  });
  const entrada = await prisma.entrada.create({
    data: {
      eventoId: evento.id,
      categoriaId: evento.categorias[0].id,
      titularId: esc.usuarios.cliente,
      codigo: `${manilla}-ENTRADA`,
      codigoQr: `${manilla}-ENTRADA`,
    },
    select: { id: true },
  });
  await Promise.all([
    prisma.manilla.create({
      data: { eventoId: evento.id, entradaId: entrada.id, codigoFisico: manilla, vinculada: true, vinculadaAt: new Date() },
    }),
    prisma.saldoEvento.create({ data: { usuarioId: esc.usuarios.cliente, eventoId: evento.id, saldo: 80 } }),
  ]);
  return { id: evento.id, manilla };
}

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  const config = {
    get: (_key: string, fallback?: string) => process.env.APP_TIMEZONE ?? fallback,
  } as unknown as ConfigService;
  devoluciones = new DevolucionesService(prisma, config, new CodigoClienteService(prisma));
  movimientos = new MovimientosService(prisma, config);
  personal = new PersonalEventoService(prisma);

  await limpiarDatosPrueba(prisma, { creadosAntesDe: new Date(Date.now() - DOS_HORAS) });
  esc = await crearEscenario(prisma, sufijo);

  [encargado, encargado2] = await Promise.all([
    crearUsuario(prisma, 'devoluciones', sufijo, [Role.DEVOLUCIONES]),
    crearUsuario(prisma, 'devoluciones2', sufijo, [Role.DEVOLUCIONES]),
  ]);
  const [enPlazo, cancelado, vencido] = await Promise.all([
    crearEventoPasado('Feria de hace 5 días', EventoEstado.FINALIZADO, 5),
    crearEventoPasado('Feria cancelada', EventoEstado.CANCELADO, 3),
    crearEventoPasado('Feria de hace 40 días', EventoEstado.FINALIZADO, 40),
  ]);
  pasados = { enPlazo, cancelado, vencido };

  // HU-046: foto del primer ingreso con la entrada de la manilla (no con la del QR digital).
  const manilla = await prisma.manilla.findFirstOrThrow({
    where: { codigoFisico: esc.codigos.manilla },
    select: { entradaId: true },
  });
  await Promise.all([
    prisma.staffEvento.createMany({
      data: [esc.eventos.abierto, enPlazo.id, cancelado.id, vencido.id].map((eventoId) => ({
        usuarioId: encargado,
        eventoId,
        role: Role.DEVOLUCIONES,
      })),
    }),
    prisma.accesoEvento.create({
      data: { eventoId: esc.eventos.abierto, entradaId: manilla.entradaId!, tipo: 'INGRESO', fotoIngresoUrl: FOTO_URL },
    }),
    prisma.usuario.update({ where: { id: esc.usuarios.cliente }, data: { documento: `PA${sufijo}` } }),
  ]);
});

afterAll(async () => {
  if (prisma) {
    await limpiarDatosPrueba(prisma, { sufijo });
    await prisma.$disconnect();
  }
});

describe('Contexto del encargado', () => {
  it('lista solo sus eventos asignados, con el plazo; los vigentes primero y el vencido al final', async () => {
    const ctx = await devoluciones.contexto(encargado);
    const ids = ctx.eventos.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([esc.eventos.abierto, pasados.enPlazo.id, pasados.cancelado.id, pasados.vencido.id]),
    );
    expect(ids).not.toContain(esc.eventos.cerrado);
    expect(ids[ids.length - 1]).toBe(pasados.vencido.id);

    const vencido = ctx.eventos.find((e) => e.id === pasados.vencido.id)!;
    expect(vencido).toMatchObject({ disponible: false, momento: 'FINALIZADO', plazo: { vencido: true } });
    expect(vencido.plazo?.fechaLimite).toBe(diaLaPaz(10));

    const enPlazo = ctx.eventos.find((e) => e.id === pasados.enPlazo.id)!;
    expect(enPlazo).toMatchObject({ disponible: true, plazo: { vencido: false, diasRestantes: 26 } });
    expect(ctx.eventos.find((e) => e.id === pasados.cancelado.id)).toMatchObject({ disponible: true, cancelado: true });
  });

  it('un encargado sin asignaciones no ve ningún evento', async () => {
    expect((await devoluciones.contexto(encargado2)).eventos).toEqual([]);
  });
});

describe('HU-026 / HU-027 · Identificar al cliente y consultar su saldo', () => {
  beforeAll(() => setSaldo(prisma, esc, 100));

  it('por la manilla: titular, documento, foto del primer ingreso y todo su saldo para devolver', async () => {
    const r = await devoluciones.consultarCliente(encargado, {
      eventoId: esc.eventos.abierto,
      codigo: esc.codigos.manilla,
    });
    expect(r.cliente).toMatchObject({
      nombre: 'Prueba cliente Auto',
      documento: `PA${sufijo}`,
      medio: 'MANILLA',
      identificador: esc.codigos.manilla,
    });
    expect(r.fotoIngreso?.url).toBe(FOTO_URL);
    expect(r).toMatchObject({ saldo: '100.00', montoDevolvible: '100.00', puedeDevolver: true, motivo: null });
    expect(r.plazo).toMatchObject({ vencido: false });
  });

  it('por el QR digital de otra entrada suya: usa la foto del primer ingreso que tenga en el evento', async () => {
    const r = await devoluciones.consultarCliente(encargado, { eventoId: esc.eventos.abierto, codigo: esc.codigos.qr });
    expect(r.cliente.medio).toBe('QR_DIGITAL');
    expect(r.fotoIngreso?.url).toBe(FOTO_URL);
    expect(r.saldo).toBe('100.00');
  });

  it('un cliente sin saldo ni foto: no se le puede devolver nada', async () => {
    const r = await devoluciones.consultarCliente(encargado, {
      eventoId: esc.eventos.abierto,
      codigo: esc.codigos.qrCliente2,
    });
    expect(r).toMatchObject({ saldo: '0.00', montoDevolvible: '0.00', puedeDevolver: false, fotoIngreso: null });
    expect(r.motivo).toMatch(/no tiene saldo/);
  });

  it('con el plazo vencido muestra el saldo pero no permite devolverlo', async () => {
    const r = await devoluciones.consultarCliente(encargado, {
      eventoId: pasados.vencido.id,
      codigo: pasados.vencido.manilla,
    });
    expect(r).toMatchObject({ saldo: '80.00', montoDevolvible: '0.00', puedeDevolver: false });
    expect(r.motivo).toMatch(/venció/);
  });

  it('quien no está asignado al evento no puede consultar', async () => {
    const err = await capturar(
      devoluciones.consultarCliente(encargado2, { eventoId: esc.eventos.abierto, codigo: esc.codigos.manilla }),
    );
    expect(err).toBeInstanceOf(ForbiddenException);
  });

  it('rechaza manillas sin vincular, entradas anuladas y códigos de otro evento', async () => {
    const consulta = (codigo: string) => devoluciones.consultarCliente(encargado, { eventoId: esc.eventos.abierto, codigo });
    expect(cuerpo(await capturar(consulta(esc.codigos.manillaSinVincular))).message).toMatch(/no está vinculada/);
    expect(cuerpo(await capturar(consulta(esc.codigos.entradaAnulada))).message).toMatch(/anulada/);
    expect(cuerpo(await capturar(consulta(esc.codigos.entradaOtroEvento))).message).toMatch(/otro evento/);
  });
});

describe('HU-028 · Devolución en efectivo', () => {
  it('deja el saldo en cero y registra la devolución con el encargado y el evento', async () => {
    await setSaldo(prisma, esc, 100);
    const antes = (await devolucionesDe(esc.eventos.abierto)).length;
    const r = await devoluciones.devolver(encargado, devolucion(100));

    expect(r).toMatchObject({ repetido: false, monto: '100.00', saldoAnterior: '100.00', saldoResultante: '0.00' });
    expect(r.codigo).toMatch(/^TX-/);
    expect(await getSaldo(prisma, esc)).toBe('0.00');

    const lista = await devolucionesDe(esc.eventos.abierto);
    expect(lista).toHaveLength(antes + 1);
    expect(lista[lista.length - 1]).toMatchObject({
      id: r.transaccionId,
      operadorId: encargado,
      estado: 'COMPLETADA',
      nota: 'Devolución en efectivo',
    });
    expect(lista[lista.length - 1].monto.toFixed(2)).toBe('100.00');
    expect(lista[lista.length - 1].saldoResultante.toFixed(2)).toBe('0.00');
  });

  it('el cliente la ve en sus movimientos como salida de saldo', async () => {
    const { movimientos: lista } = await movimientos.misMovimientos(esc.usuarios.cliente, {
      eventoId: esc.eventos.abierto,
      tipo: TipoTransaccionSaldo.DEVOLUCION,
    });
    expect(lista[0]).toMatchObject({ tipo: 'DEVOLUCION', monto: '-100.00', saldoResultante: '0.00' });
  });

  it('una segunda devolución sin saldo se rechaza (SIN_SALDO)', async () => {
    await setSaldo(prisma, esc, 0);
    const err = await capturar(devoluciones.devolver(encargado, devolucion(100)));
    expect(err).toBeInstanceOf(ConflictException);
    expect(cuerpo(err).code).toBe('SIN_SALDO');
  });

  it('si el saldo cambió desde la consulta, no devuelve nada y avisa el saldo real (SALDO_CAMBIO)', async () => {
    await setSaldo(prisma, esc, 94);
    const err = await capturar(devoluciones.devolver(encargado, devolucion(100)));
    expect(err).toBeInstanceOf(ConflictException);
    expect(cuerpo(err)).toMatchObject({ code: 'SALDO_CAMBIO', saldo: '94.00' });
    expect(await getSaldo(prisma, esc)).toBe('94.00');
  });

  it('con decimales: devuelve exactamente el saldo', async () => {
    await setSaldo(prisma, esc, 37.5);
    const r = await devoluciones.devolver(encargado, devolucion(37.5));
    expect(r.monto).toBe('37.50');
    expect(await getSaldo(prisma, esc)).toBe('0.00');
  });

  it('después del evento, dentro de los 30 días, se puede devolver', async () => {
    const r = await devoluciones.devolver(encargado, {
      eventoId: pasados.enPlazo.id,
      codigo: pasados.enPlazo.manilla,
      montoEsperado: 80,
      identidadVerificada: true,
    });
    expect(r.monto).toBe('80.00');
    expect(await saldoEn(pasados.enPlazo.id)).toBe('0.00');
  });

  it('en un evento cancelado corre el mismo plazo desde su última fecha', async () => {
    const r = await devoluciones.devolver(encargado, {
      eventoId: pasados.cancelado.id,
      codigo: pasados.cancelado.manilla,
      montoEsperado: 80,
      identidadVerificada: true,
    });
    expect(r.monto).toBe('80.00');
  });

  it('vencido el plazo se rechaza (PLAZO_VENCIDO) y el saldo no se toca', async () => {
    const err = await capturar(
      devoluciones.devolver(encargado, {
        eventoId: pasados.vencido.id,
        codigo: pasados.vencido.manilla,
        montoEsperado: 80,
        identidadVerificada: true,
      }),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(cuerpo(err).code).toBe('PLAZO_VENCIDO');
    expect(await saldoEn(pasados.vencido.id)).toBe('80.00');
    expect(await devolucionesDe(pasados.vencido.id)).toHaveLength(0);
  });

  it('quien no está asignado al evento no puede devolver', async () => {
    await setSaldo(prisma, esc, 50);
    const err = await capturar(devoluciones.devolver(encargado2, devolucion(50)));
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(await getSaldo(prisma, esc)).toBe('50.00');
  });
});

describe('HU-028 · Nunca se paga dos veces', () => {
  it('un reintento con la misma clave devuelve el comprobante original y no descuenta otra vez', async () => {
    await setSaldo(prisma, esc, 60);
    const clave = randomUUID();
    const primera = await devoluciones.devolver(encargado, devolucion(60, { idempotencyKey: clave }));
    // El cliente vuelve a tener saldo (p. ej. una recarga): el reintento no debe tocarlo.
    await setSaldo(prisma, esc, 60);
    const reintento = await devoluciones.devolver(encargado, devolucion(60, { idempotencyKey: clave }));

    expect(reintento).toMatchObject({ repetido: true, transaccionId: primera.transaccionId, monto: '60.00' });
    expect(await getSaldo(prisma, esc)).toBe('60.00');
    expect((await devolucionesDe(esc.eventos.abierto)).filter((t) => t.id === clave)).toHaveLength(1);
  });

  it('la misma clave enviada dos veces a la vez registra una sola devolución', async () => {
    await setSaldo(prisma, esc, 45);
    const clave = randomUUID();
    const antes = (await devolucionesDe(esc.eventos.abierto)).length;
    const resultados = await Promise.allSettled([
      devoluciones.devolver(encargado, devolucion(45, { idempotencyKey: clave })),
      devoluciones.devolver(encargado, devolucion(45, { idempotencyKey: clave })),
    ]);
    expect(resultados.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await devolucionesDe(esc.eventos.abierto)).toHaveLength(antes + 1);
    expect(await getSaldo(prisma, esc)).toBe('0.00');
  });

  it('dos devoluciones distintas a la vez: solo una paga, la otra recibe 409', async () => {
    await setSaldo(prisma, esc, 70);
    const antes = (await devolucionesDe(esc.eventos.abierto)).length;
    const resultados = await Promise.allSettled([
      devoluciones.devolver(encargado, devolucion(70)),
      devoluciones.devolver(encargado, devolucion(70)),
    ]);
    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const fallidas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(fallidas[0].reason).toBeInstanceOf(ConflictException);
    expect(await devolucionesDe(esc.eventos.abierto)).toHaveLength(antes + 1);
    expect(await getSaldo(prisma, esc)).toBe('0.00');
  });

  it('una clave ya usada por otro encargado se rechaza', async () => {
    await setSaldo(prisma, esc, 20);
    const clave = randomUUID();
    await devoluciones.devolver(encargado, devolucion(20, { idempotencyKey: clave }));
    const err = await capturar(devoluciones.devolver(encargado2, devolucion(20, { idempotencyKey: clave })));
    expect(err).toBeInstanceOf(ConflictException);
    expect(cuerpo(err).message).toMatch(/ya fue utilizada/);
  });
});

describe('Plazo en "Mis saldos" y personal del evento', () => {
  it('el cliente ve hasta cuándo puede pedir la devolución de cada evento', async () => {
    const { saldos } = await movimientos.misSaldos(esc.usuarios.cliente);
    expect(saldos.find((s) => s.eventoId === pasados.enPlazo.id)?.plazoRetiro).toEqual({
      fechaLimite: diaLaPaz(-25),
      vencido: false,
    });
    expect(saldos.find((s) => s.eventoId === pasados.vencido.id)?.plazoRetiro).toMatchObject({ vencido: true });
  });

  it('un encargado de devoluciones se puede asignar a un evento finalizado; un recargador no', async () => {
    const r = await personal.asignar(pasados.enPlazo.id, { usuarioId: encargado2, role: Role.DEVOLUCIONES });
    expect(r.personal.some((p) => p.usuario.id === encargado2 && p.role === Role.DEVOLUCIONES)).toBe(true);

    const err = await capturar(
      personal.asignar(pasados.enPlazo.id, { usuarioId: esc.usuarios.recargador, role: Role.RECARGADOR }),
    );
    expect(err).toBeInstanceOf(BadRequestException);
  });
});
