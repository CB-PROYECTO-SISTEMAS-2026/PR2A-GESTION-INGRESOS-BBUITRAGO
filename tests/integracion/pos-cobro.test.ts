/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA DE INTEGRACIÓN · Cobro en el punto de venta (Módulo E: HU-022, HU-023, HU-024)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    El servicio real del cobro (PosService) contra la base de datos real:
 *      1. Cobro correcto por manilla y por QR digital: descuenta el saldo y registra la venta,
 *         sus detalles y la transacción de saldo, con los precios de la base de datos.
 *      2. Saldo insuficiente (HU-023): se rechaza sin tocar el saldo ni crear la venta.
 *      3. Cobros SIMULTÁNEOS sobre el mismo saldo: nunca queda en negativo.
 *      4. Clave anti-cobro-duplicado: un reintento no cobra dos veces (ni en simultáneo) y la
 *         clave de otro ayudante se rechaza.
 *      5. Stock: rechaza pedidos que lo superan y, con dos compras simultáneas de la última
 *         unidad, solo pasa una.
 *      6. Reglas de acceso: evento fuera de horario, negocio no habilitado, código de otro
 *         evento, entrada anulada, manilla sin vincular, ayudante inactivo, producto de otro
 *         negocio o desactivado, código inexistente.
 *      7. Consulta previa del cliente y el historial del ayudante (HU-024).
 *
 *  POR QUÉ IMPORTA
 *    Es el dinero de los clientes. Un error aquí cobra de más, cobra dos veces o deja saldos
 *    negativos. Estas pruebas usan la base real porque varias garantías (atomicidad, bloqueo
 *    de saldo y stock) solo existen en la base de datos.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/pos/pos.service.ts      (cobrar, consultarCliente, misVentas)
 *    backend/src/modules/pos/negocio-compat.ts   (stock y validaciones del negocio)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                                  (solo la primera vez)
 *    npm run test:integracion                     (todas las de integración, una tras otra)
 *    npx jest --runInBand integracion/pos-cobro   (solo este archivo)
 *
 *  REQUISITOS
 *    - backend/.env y backend/prisma/ca.pem (usa la misma base compartida de Aiven).
 *    - Internet. Tarda alrededor de 1 a 2 minutos: cada consulta a Aiven demora ~180 ms.
 *    - No hace falta levantar el backend: se llama al servicio directamente.
 *
 *  QUÉ DATOS USA
 *    Crea su propio escenario (usuarios @pruebas.eventix.test, negocios y eventos
 *    "[PRUEBA-AUTO]") y lo borra al terminar, aunque las pruebas fallen. Nunca toca datos
 *    reales. Si la ejecución se corta (Ctrl+C), la próxima borra los restos de más de 2 horas;
 *    o puedes borrarlos ya con `npm run limpiar` (vista previa) y `npm run limpiar:confirmar`.
 *    Mientras corre, los eventos de prueba pueden verse en la landing pública.
 *
 *  CÓMO LEER EL RESULTADO
 *    Cada `it(...)` es una regla de negocio. En los errores esperados se compara el tipo de
 *    error HTTP (400, 403, 404, 409) y el mensaje que vería el ayudante en el celular.
 *
 *  SI FALLA
 *    - "Can't reach database server": revisa internet, backend/.env y backend/prisma/ca.pem.
 *    - "Unknown column": la base compartida cambió de estructura; revisa negocio-compat.ts y
 *      helpers/escenario.ts.
 *    - Una regla de negocio: revisa pos.service.ts. Si el cambio fue intencional, actualiza la
 *      prueba.
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
import { TipoTransaccionSaldo } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import { PosService } from '../../backend/src/modules/pos/pos.service';
import {
  Escenario,
  SALDO_INICIAL,
  contarVentas,
  crearEscenario,
  getSaldo,
  getStock,
  nuevoSufijo,
  setEstadoAyudante,
  setSaldo,
  setStock,
} from './helpers/escenario';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba } = require('./helpers/limpieza');

const DOS_HORAS = 2 * 60 * 60 * 1000;

let prisma: PrismaService;
let pos: PosService;
let esc: Escenario;
const sufijo = nuevoSufijo();

/** Devuelve el error HTTP que lanza la promesa (falla la prueba si no lanza ninguno). */
async function capturar(promesa: Promise<unknown>): Promise<HttpException> {
  try {
    await promesa;
  } catch (err) {
    expect(err).toBeInstanceOf(HttpException);
    return err as HttpException;
  }
  throw new Error('Se esperaba un error y la operación terminó bien.');
}

const mensaje = (err: HttpException) => {
  const r = err.getResponse();
  return typeof r === 'string' ? r : (r as { message: string }).message;
};

/** Cuerpo de un cobro en el evento abierto. */
const cobro = (items: { productoId: string; cantidad: number }[], extra: Record<string, unknown> = {}) => ({
  eventoId: esc.eventos.abierto,
  codigo: esc.codigos.manilla,
  items,
  ...extra,
});

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  pos = new PosService(prisma, {
    get: (_key: string, fallback?: string) => process.env.APP_TIMEZONE ?? fallback,
  } as unknown as ConfigService);

  // Restos de ejecuciones anteriores que se cortaron (de más de 2 horas, para no borrar los
  // datos de otra persona que esté corriendo las pruebas en este momento).
  await limpiarDatosPrueba(prisma, { creadosAntesDe: new Date(Date.now() - DOS_HORAS) });
  esc = await crearEscenario(prisma, sufijo);
});

// Borra lo creado por ESTA ejecución, aunque la creación del escenario o las pruebas fallen.
afterAll(async () => {
  if (prisma) {
    await limpiarDatosPrueba(prisma, { sufijo });
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  await setSaldo(prisma, esc, SALDO_INICIAL);
});

describe('Cobro correcto (HU-022)', () => {
  it('cobra con la manilla: descuenta el saldo y registra venta, detalles y transacción', async () => {
    const ventasAntes = await contarVentas(prisma, esc);

    const r = await pos.cobrar(
      esc.usuarios.ayudante,
      cobro([
        { productoId: esc.productos.empanada, cantidad: 2 },
        { productoId: esc.productos.refresco, cantidad: 1 },
      ]),
    );

    expect(r.total).toBe('26.00'); // 2 × 10 + 1 × 6, precios de la base de datos
    expect(r.saldoResultante).toBe('74.00');
    expect(r.repetido).toBe(false);
    expect(r.cliente.medio).toBe('MANILLA');
    expect(r.codigo).toMatch(/^TX-[0-9A-Z]{8}$/);
    expect(await getSaldo(prisma, esc)).toBe('74.00');
    expect(await contarVentas(prisma, esc)).toBe(ventasAntes + 1);

    const venta = await prisma.venta.findUniqueOrThrow({
      where: { id: r.ventaId },
      select: {
        total: true,
        negocioId: true,
        ayudanteId: true,
        clienteId: true,
        detalles: { select: { productoId: true, cantidad: true, precioUnit: true, subtotal: true } },
        transacciones: { select: { tipo: true, monto: true, saldoResultante: true, operadorId: true } },
      },
    });
    expect(venta.total.toFixed(2)).toBe('26.00');
    expect(venta.negocioId).toBe(esc.negocioId);
    expect(venta.ayudanteId).toBe(esc.usuarios.ayudante);
    expect(venta.clienteId).toBe(esc.usuarios.cliente);
    expect(venta.detalles).toHaveLength(2);
    expect(venta.transacciones).toEqual([
      expect.objectContaining({
        tipo: TipoTransaccionSaldo.COMPRA_PRODUCTO,
        operadorId: esc.usuarios.ayudante,
      }),
    ]);
    expect(venta.transacciones[0].monto.toFixed(2)).toBe('26.00');
    expect(venta.transacciones[0].saldoResultante.toFixed(2)).toBe('74.00');
  });

  it('cobra con el QR digital de la entrada, aunque se escriba en minúsculas', async () => {
    const r = await pos.cobrar(
      esc.usuarios.ayudante,
      cobro([{ productoId: esc.productos.refresco, cantidad: 1 }], {
        codigo: esc.codigos.qr.toLowerCase(),
      }),
    );
    expect(r.cliente.medio).toBe('QR_DIGITAL');
    expect(r.saldoResultante).toBe('94.00');
  });

  it('puede cobrar exactamente todo el saldo (queda en 0)', async () => {
    await setSaldo(prisma, esc, 20);
    const r = await pos.cobrar(esc.usuarios.ayudante, cobro([{ productoId: esc.productos.empanada, cantidad: 2 }]));
    expect(r.saldoResultante).toBe('0.00');
  });
});

describe('Saldo insuficiente (HU-023)', () => {
  it('rechaza el cobro con 409 y no toca el saldo ni crea la venta', async () => {
    await setSaldo(prisma, esc, 15);
    const ventasAntes = await contarVentas(prisma, esc);

    const err = await capturar(
      pos.cobrar(esc.usuarios.ayudante, cobro([{ productoId: esc.productos.empanada, cantidad: 2 }])),
    );

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({
      code: 'SALDO_INSUFICIENTE',
      saldo: '15.00',
      total: '20.00',
      faltante: '5.00',
    });
    expect(await getSaldo(prisma, esc)).toBe('15.00');
    expect(await contarVentas(prisma, esc)).toBe(ventasAntes);
  });

  it('con 5 cobros simultáneos de Bs 30 sobre Bs 100, pasan 3 y el saldo nunca queda negativo', async () => {
    const intentos = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        pos.cobrar(esc.usuarios.ayudante, cobro([{ productoId: esc.productos.empanada, cantidad: 3 }])),
      ),
    );

    const exitosos = intentos.filter((i) => i.status === 'fulfilled');
    const rechazados = intentos.filter((i) => i.status === 'rejected');
    expect(exitosos).toHaveLength(3);
    expect(rechazados).toHaveLength(2);
    for (const r of rechazados) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    }
    expect(await getSaldo(prisma, esc)).toBe('10.00');
  });
});

describe('Clave anti-cobro-duplicado', () => {
  it('un reintento con la misma clave devuelve el cobro original y no vuelve a descontar', async () => {
    const clave = randomUUID();
    const pedido = cobro([{ productoId: esc.productos.empanada, cantidad: 1 }], { idempotencyKey: clave });

    const primero = await pos.cobrar(esc.usuarios.ayudante, pedido);
    const reintento = await pos.cobrar(esc.usuarios.ayudante, pedido);

    expect(primero.repetido).toBe(false);
    expect(reintento.repetido).toBe(true);
    expect(reintento.ventaId).toBe(primero.ventaId);
    expect(reintento.codigo).toBe(primero.codigo);
    expect(reintento.saldoResultante).toBe('90.00');
    expect(await getSaldo(prisma, esc)).toBe('90.00');
    expect(await prisma.venta.count({ where: { id: clave } })).toBe(1);
  });

  it('tres envíos SIMULTÁNEOS con la misma clave cobran una sola vez', async () => {
    const clave = randomUUID();
    const pedido = cobro([{ productoId: esc.productos.empanada, cantidad: 1 }], { idempotencyKey: clave });

    const resultados = await Promise.allSettled([1, 2, 3].map(() => pos.cobrar(esc.usuarios.ayudante, pedido)));

    const exitosos = resultados.filter((r) => r.status === 'fulfilled');
    expect(exitosos.length).toBeGreaterThanOrEqual(1);
    expect(await getSaldo(prisma, esc)).toBe('90.00');
    expect(await prisma.venta.count({ where: { id: clave } })).toBe(1);
  });

  it('rechaza una clave que ya usó OTRO ayudante', async () => {
    const clave = randomUUID();
    await pos.cobrar(
      esc.usuarios.ayudante,
      cobro([{ productoId: esc.productos.refresco, cantidad: 1 }], { idempotencyKey: clave }),
    );
    const err = await capturar(
      pos.cobrar(
        esc.usuarios.ayudante2,
        cobro([{ productoId: esc.productos.refresco, cantidad: 1 }], { idempotencyKey: clave }),
      ),
    );
    expect(err).toBeInstanceOf(ConflictException);
    expect(mensaje(err)).toBe('La clave de este cobro ya fue utilizada.');
    expect(await getSaldo(prisma, esc)).toBe('94.00');
  });
});

describe('Stock de productos', () => {
  afterAll(async () => setStock(prisma, esc.productos.limitado, null));

  it('descuenta el stock al cobrar', async () => {
    await setStock(prisma, esc.productos.limitado, 5);
    await pos.cobrar(esc.usuarios.ayudante, cobro([{ productoId: esc.productos.limitado, cantidad: 2 }]));
    expect(await getStock(prisma, esc.productos.limitado)).toBe(3);
  });

  it('rechaza pedir más de lo que queda, sin cobrar', async () => {
    await setStock(prisma, esc.productos.limitado, 2);
    const err = await capturar(
      pos.cobrar(esc.usuarios.ayudante, cobro([{ productoId: esc.productos.limitado, cantidad: 3 }])),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(mensaje(err)).toBe('No hay stock suficiente de Producto con stock: quedan 2.');
    expect(await getSaldo(prisma, esc)).toBe('100.00');
  });

  it('avisa que el producto está agotado', async () => {
    await setStock(prisma, esc.productos.limitado, 0);
    const err = await capturar(
      pos.cobrar(esc.usuarios.ayudante, cobro([{ productoId: esc.productos.limitado, cantidad: 1 }])),
    );
    expect(mensaje(err)).toBe('Producto con stock está agotado.');
  });

  it('con dos compras simultáneas de la última unidad, solo pasa una y el saldo se descuenta una vez', async () => {
    await setStock(prisma, esc.productos.limitado, 1);
    const resultados = await Promise.allSettled(
      [1, 2].map(() =>
        pos.cobrar(esc.usuarios.ayudante, cobro([{ productoId: esc.productos.limitado, cantidad: 1 }])),
      ),
    );
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await getStock(prisma, esc.productos.limitado)).toBe(0);
    expect(await getSaldo(prisma, esc)).toBe('92.00');
  });
});

describe('Reglas de acceso al cobro', () => {
  it('rechaza cobrar en un evento fuera de su horario', async () => {
    const err = await capturar(
      pos.cobrar(
        esc.usuarios.ayudante,
        cobro([{ productoId: esc.productos.refresco, cantidad: 1 }], {
          eventoId: esc.eventos.cerrado,
          codigo: esc.codigos.entradaOtroEvento,
        }),
      ),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(mensaje(err)).toBe(
      `El evento está cerrado en este momento. Horario de hoy: ${esc.horarioCerrado}.`,
    );
  });

  it('rechaza cobrar en un evento donde el negocio no fue aceptado (403)', async () => {
    const err = await capturar(
      pos.cobrar(
        esc.usuarios.ayudante,
        cobro([{ productoId: esc.productos.refresco, cantidad: 1 }], { eventoId: esc.eventos.noHabilitado }),
      ),
    );
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(mensaje(err)).toBe('Tu negocio no está habilitado para vender en este evento.');
  });

  it.each([
    ['un código de otro evento', 'entradaOtroEvento', BadRequestException, 'Este código pertenece a otro evento.'],
    ['una entrada anulada', 'entradaAnulada', BadRequestException, 'La entrada está anulada o fue reembolsada.'],
    [
      'una manilla sin vincular',
      'manillaSinVincular',
      BadRequestException,
      'Esta manilla todavía no está vinculada a una entrada.',
    ],
  ] as const)('rechaza %s', async (_caso, codigo, tipo, texto) => {
    const err = await capturar(
      pos.cobrar(
        esc.usuarios.ayudante,
        cobro([{ productoId: esc.productos.refresco, cantidad: 1 }], { codigo: esc.codigos[codigo] }),
      ),
    );
    expect(err).toBeInstanceOf(tipo);
    expect(mensaje(err)).toBe(texto);
  });

  it('responde 404 si el código no existe', async () => {
    const err = await capturar(
      pos.cobrar(
        esc.usuarios.ayudante,
        cobro([{ productoId: esc.productos.refresco, cantidad: 1 }], { codigo: 'NO-EXISTE-PRUEBA-AUTO' }),
      ),
    );
    expect(err).toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['de otro negocio', 'ajeno'],
    ['desactivado', 'inactivo'],
  ] as const)('rechaza un producto %s', async (_caso, producto) => {
    const err = await capturar(
      pos.cobrar(esc.usuarios.ayudante, cobro([{ productoId: esc.productos[producto], cantidad: 1 }])),
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(mensaje(err)).toBe('Algunos productos ya no están disponibles. Actualiza el catálogo.');
  });

  it('rechaza a un ayudante inactivo (403)', async () => {
    await setEstadoAyudante(prisma, esc.usuarios.ayudante2, 'INACTIVO');
    try {
      const err = await capturar(
        pos.cobrar(esc.usuarios.ayudante2, cobro([{ productoId: esc.productos.refresco, cantidad: 1 }])),
      );
      expect(err).toBeInstanceOf(ForbiddenException);
    } finally {
      await setEstadoAyudante(prisma, esc.usuarios.ayudante2, 'ACTIVO');
    }
  });

  it('rechaza a un usuario que no es ayudante de ningún negocio (403)', async () => {
    const err = await capturar(
      pos.cobrar(esc.usuarios.cliente, cobro([{ productoId: esc.productos.refresco, cantidad: 1 }])),
    );
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(mensaje(err)).toBe('No estás asignado a ningún negocio.');
  });
});

describe('Consulta previa y catálogo', () => {
  it('consulta al cliente y su saldo antes de cobrar (HU-023)', async () => {
    await setSaldo(prisma, esc, 42.5);
    const r = await pos.consultarCliente(esc.usuarios.ayudante, {
      eventoId: esc.eventos.abierto,
      codigo: esc.codigos.manilla,
    });
    expect(r).toEqual({
      cliente: {
        nombre: 'Prueba cliente Auto',
        medio: 'MANILLA',
        identificador: esc.codigos.manilla,
        categoria: 'General',
      },
      saldo: '42.50',
    });
  });

  it('el catálogo muestra solo productos activos del negocio y el evento abierto', async () => {
    const ctx = await pos.contexto(esc.usuarios.ayudante);
    expect(ctx.negocio.id).toBe(esc.negocioId);
    expect(ctx.productos.map((p) => p.id).sort()).toEqual(
      [esc.productos.empanada, esc.productos.refresco, esc.productos.limitado].sort(),
    );
    const abierto = ctx.eventos.find((e) => e.id === esc.eventos.abierto);
    const cerrado = ctx.eventos.find((e) => e.id === esc.eventos.cerrado);
    expect(abierto).toMatchObject({ enCurso: true, horarioHoy: '00:00 – 23:59' });
    expect(cerrado).toMatchObject({ enCurso: false, horarioHoy: esc.horarioCerrado });
    expect(ctx.eventos.some((e) => e.id === esc.eventos.noHabilitado)).toBe(false);
  });
});

describe('Historial del ayudante (HU-024)', () => {
  it('muestra los cobros del día del ayudante con su total', async () => {
    const r = await pos.cobrar(esc.usuarios.ayudante2, cobro([{ productoId: esc.productos.empanada, cantidad: 1 }]));
    const historial = await pos.misVentas(esc.usuarios.ayudante2, {});

    expect(historial.ventas.map((v) => v.id)).toContain(r.ventaId);
    const venta = historial.ventas.find((v) => v.id === r.ventaId)!;
    expect(venta).toMatchObject({ total: '10.00', cliente: 'Prueba cliente Auto', productos: '1x Empanada' });
    // El total del día es la suma de las ventas listadas.
    const suma = historial.ventas.reduce((acc, v) => acc + Number(v.total), 0);
    expect(Number(historial.total)).toBeCloseTo(suma, 2);
    expect(historial.cantidad).toBe(historial.ventas.length);
  });
});
