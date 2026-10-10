/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA DE INTEGRACIÓN · Panel de ventas, liquidación y retiros del negocio (Módulo E: HU-025)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    Los servicios reales del panel del dueño (NegocioVentasService) y de la gestión de retiros
 *    del administrador (RetirosAdminService), contra la base de datos real:
 *      1. Panel de ventas: totales, ticket promedio, ventas por día (hora de La Paz), por
 *         evento y productos más vendidos; filtro por evento; registro paginado.
 *      2. Exportación CSV: formato para Excel y protección contra fórmulas en nombres.
 *      3. Liquidación: lo vendido en eventos cerrados (FINALIZADO, CANCELADO o con su último
 *         día ya pasado) queda ACREDITADO; lo de eventos en curso queda PENDIENTE.
 *      4. Retiros del dueño: solicita todo lo disponible, no puede retirar dos veces (tampoco
 *         con dos solicitudes simultáneas) y no puede operar negocios ajenos.
 *      5. Retiros del administrador: SOLICITADO → APROBADO → PAGADO (con comprobante) o
 *         RECHAZADO; transiciones inválidas rechazadas; un rechazo devuelve el monto al negocio.
 *
 *  POR QUÉ IMPORTA
 *    Es el dinero de los negocios. Un error aquí paga dos veces el mismo saldo, acredita ventas
 *    de eventos que no terminaron o muestra totales que no cuadran con la caja.
 *
 *  CÓDIGO PROBADO
 *    backend/src/modules/pos/negocio-ventas.service.ts   (resumen, ventas, CSV, liquidación, retiros)
 *    backend/src/modules/pos/retiros-admin.service.ts    (aprobar, rechazar, pagar)
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                                         (solo la primera vez)
 *    npm run test:integracion                            (todas las de integración, una tras otra)
 *    npx jest --runInBand integracion/pos-liquidacion    (solo este archivo)
 *
 *  REQUISITOS
 *    - backend/.env y backend/prisma/ca.pem (usa la misma base compartida de Aiven).
 *    - Internet. Tarda alrededor de 1 minuto.
 *    - NO sube archivos a Cloudinary: el almacenamiento de comprobantes se reemplaza por uno
 *      simulado (por eso esta prueba no verifica la subida real del archivo).
 *
 *  QUÉ DATOS USA
 *    Igual que pos-cobro.test.ts: crea su propio escenario "[PRUEBA-AUTO]" (más 3 eventos ya
 *    pasados y ventas registradas en ellos) y lo borra al terminar. Si se corta, usa
 *    `npm run limpiar` / `npm run limpiar:confirmar`.
 *
 *  CÓMO LEER EL RESULTADO
 *    Las pruebas de cada `describe` se ejecutan en orden y comparten estado (p. ej. el retiro
 *    que se solicita en una prueba se aprueba en la siguiente). Si una falla, las siguientes
 *    del mismo bloque pueden fallar en cadena: arregla primero la primera que falló.
 *
 *  VENTAS DEL ESCENARIO (precios: Empanada 10, Refresco 6, Producto con stock 8)
 *    Evento FINALIZADO, ayer ............. V1: 3 Empanadas = 30 (12:00)
 *                                          V2: 2 Refrescos + 1 Producto con stock = 20 (18:30)
 *    Evento PUBLICADO, hace 3 días ....... V3: 1 Empanada + 1 Refresco = 16
 *    Evento CANCELADO, hace 2 días ....... V4: 1 Refresco = 6
 *    Evento abierto, hoy ................. V5: 1 Empanada = 10
 *    → Acreditado 72 (30+20+16+6) · Pendiente 10 · Total 82 en 5 ventas y 10 productos
 *
 *  SI FALLA
 *    - Totales: revisa resumen() y el cálculo de días en hora de La Paz (pos-dates.ts).
 *    - Acreditado/pendiente: revisa calcularBalances() (qué cuenta como evento cerrado).
 *    - Retiros: revisa solicitarRetiro() (bloqueo FOR UPDATE) y retiros-admin.service.ts.
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
import { EventoEstado, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../backend/src/prisma/prisma.service';
import { StorageService } from '../../backend/src/common/storage/storage.service';
import { NegocioVentasService } from '../../backend/src/modules/pos/negocio-ventas.service';
import { RetirosAdminService } from '../../backend/src/modules/pos/retiros-admin.service';
import {
  Escenario,
  crearEscenario,
  crearEventoPasado,
  crearUsuario,
  diaLaPaz,
  instanteLaPaz,
  nuevoSufijo,
  registrarVenta,
} from './helpers/escenario';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { limpiarDatosPrueba } = require('./helpers/limpieza');

const DOS_HORAS = 2 * 60 * 60 * 1000;
const NOMBRE_MALICIOSO = '=HYPERLINK("http://malicioso.test")';

let prisma: PrismaService;
let ventas: NegocioVentasService;
let retiros: RetirosAdminService;
let esc: Escenario;
const sufijo = nuevoSufijo();
const eventos = { finalizado: '', pasado: '', cancelado: '' };

/** Almacenamiento de comprobantes simulado: no sube nada a Cloudinary. */
const storage = {
  upload: jest.fn(async () => ({
    url: 'https://comprobantes.prueba.test/retiro.png',
    publicId: 'eventix/retiros/prueba-auto',
    nombre: 'retiro.png',
  })),
  remove: jest.fn(async () => undefined),
};

/** Archivo de comprobante falso (lo que entregaría multer en una subida real). */
const comprobante = {
  originalname: 'comprobante.png',
  buffer: Buffer.from('png'),
} as NonNullable<Parameters<RetirosAdminService['pagar']>[1]>;

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

/** Liquidación del negocio del escenario. */
const liquidacion = async () => (await ventas.liquidacion(esc.usuarios.jefe)).negocios[0];

beforeAll(async () => {
  prisma = new PrismaService();
  await prisma.$connect();
  const config = {
    get: (_key: string, fallback?: string) => process.env.APP_TIMEZONE ?? fallback,
  } as unknown as ConfigService;
  ventas = new NegocioVentasService(prisma, config);
  retiros = new RetirosAdminService(prisma, storage as unknown as StorageService);

  await limpiarDatosPrueba(prisma, { creadosAntesDe: new Date(Date.now() - DOS_HORAS) });
  esc = await crearEscenario(prisma, sufijo);

  const [finalizado, pasado, cancelado, clienteMalicioso] = await Promise.all([
    crearEventoPasado(prisma, esc, 'Feria finalizada', EventoEstado.FINALIZADO, 1),
    crearEventoPasado(prisma, esc, 'Feria pasada sin cerrar', EventoEstado.PUBLICADO, 3),
    crearEventoPasado(prisma, esc, 'Feria cancelada', EventoEstado.CANCELADO, 2),
    crearUsuario(prisma, 'cliente-malicioso', sufijo, [Role.CLIENTE], NOMBRE_MALICIOSO),
  ]);
  Object.assign(eventos, { finalizado, pasado, cancelado });

  const { empanada, refresco, limitado } = esc.productos;
  await Promise.all([
    registrarVenta(prisma, esc, {
      eventoId: finalizado,
      fecha: instanteLaPaz(diaLaPaz(1), '12:00'),
      items: [{ productoId: empanada, cantidad: 3 }],
    }),
    registrarVenta(prisma, esc, {
      eventoId: finalizado,
      fecha: instanteLaPaz(diaLaPaz(1), '18:30'),
      clienteId: clienteMalicioso,
      items: [
        { productoId: refresco, cantidad: 2 },
        { productoId: limitado, cantidad: 1 },
      ],
    }),
    registrarVenta(prisma, esc, {
      eventoId: pasado,
      fecha: instanteLaPaz(diaLaPaz(3), '15:00'),
      items: [
        { productoId: empanada, cantidad: 1 },
        { productoId: refresco, cantidad: 1 },
      ],
    }),
    registrarVenta(prisma, esc, {
      eventoId: cancelado,
      fecha: instanteLaPaz(diaLaPaz(2), '11:00'),
      items: [{ productoId: refresco, cantidad: 1 }],
    }),
    registrarVenta(prisma, esc, {
      eventoId: esc.eventos.abierto,
      fecha: new Date(),
      items: [{ productoId: empanada, cantidad: 1 }],
    }),
  ]);
});

afterAll(async () => {
  if (prisma) {
    await limpiarDatosPrueba(prisma, { sufijo });
    await prisma.$disconnect();
  }
});

describe('Panel de ventas del dueño (HU-025)', () => {
  const rango = () => ({ desde: diaLaPaz(4), hasta: diaLaPaz(0) });

  it('calcula los indicadores del periodo', async () => {
    const r = await ventas.resumen(esc.usuarios.jefe, rango());
    expect(r.kpis).toEqual({
      ventasTotales: '82.00',
      transacciones: 5,
      ticketPromedio: '16.40',
      productosVendidos: 10,
      ayudantesActivos: 2,
    });
  });

  it('agrupa las ventas por día en hora de La Paz (incluye los días sin ventas)', async () => {
    const r = await ventas.resumen(esc.usuarios.jefe, rango());
    expect(r.ventasPorDia).toEqual([
      { dia: diaLaPaz(4), total: '0.00' },
      { dia: diaLaPaz(3), total: '16.00' },
      { dia: diaLaPaz(2), total: '6.00' },
      { dia: diaLaPaz(1), total: '50.00' },
      { dia: diaLaPaz(0), total: '10.00' },
    ]);
  });

  it('muestra lo recaudado por evento, de mayor a menor', async () => {
    const r = await ventas.resumen(esc.usuarios.jefe, rango());
    expect(r.porEvento.map((e) => [e.eventoId, e.total, e.transacciones])).toEqual([
      [eventos.finalizado, '50.00', 2],
      [eventos.pasado, '16.00', 1],
      [esc.eventos.abierto, '10.00', 1],
      [eventos.cancelado, '6.00', 1],
    ]);
  });

  it('ordena los productos más vendidos por monto recaudado', async () => {
    const r = await ventas.resumen(esc.usuarios.jefe, rango());
    expect(r.topProductos.map((p) => [p.nombre, p.cantidad, p.total])).toEqual([
      ['Empanada', 5, '50.00'],
      ['Refresco', 4, '24.00'],
      ['Producto con stock', 1, '8.00'],
    ]);
  });

  it('filtra por evento', async () => {
    const r = await ventas.resumen(esc.usuarios.jefe, { ...rango(), eventoId: eventos.finalizado });
    expect(r.kpis.ventasTotales).toBe('50.00');
    expect(r.kpis.transacciones).toBe(2);
  });

  it('el registro de ventas lista la más reciente primero, con cliente, ayudante y productos', async () => {
    const r = await ventas.ventas(esc.usuarios.jefe, rango());
    expect(r.totalItems).toBe(5);
    expect(r.totalRecaudado).toBe('82.00');
    expect(r.items[0]).toMatchObject({ total: '10.00', productos: '1x Empanada', cliente: 'Prueba cliente Auto' });
    expect(r.items.map((v) => v.cliente)).toContain(`${NOMBRE_MALICIOSO} Auto`);
    expect(r.items.every((v) => v.ayudante === 'Prueba ayudante Auto')).toBe(true);
  });

  it('exporta un CSV para Excel (BOM, ";" como separador) sin fórmulas ejecutables', async () => {
    const { filename, content } = await ventas.exportarCsv(esc.usuarios.jefe, rango());
    expect(filename).toBe(`ventas_${diaLaPaz(4)}_${diaLaPaz(0)}.csv`);
    expect(content.startsWith('﻿Fecha;Hora;Negocio;Evento;Cliente;Ayudante;Productos;Total (Bs)')).toBe(true);

    const filas = content.trim().split('\r\n');
    expect(filas).toHaveLength(6); // encabezado + 5 ventas
    const filaMaliciosa = filas.find((f) => f.includes('HYPERLINK'))!;
    expect(filaMaliciosa).toContain(`;"'=HYPERLINK(""http://malicioso.test"") Auto";`);
    expect(filaMaliciosa.startsWith(`${diaLaPaz(1)};18:30;`)).toBe(true);
  });

  it('el dueño de otro negocio no ve estas ventas y no puede pedir este negocio (403)', async () => {
    const ajeno = await ventas.resumen(esc.usuarios.jefeOtroNegocio, rango());
    expect(ajeno.kpis.transacciones).toBe(0);
    const err = await capturar(
      ventas.resumen(esc.usuarios.jefeOtroNegocio, { ...rango(), negocioId: esc.negocioId }),
    );
    expect(err).toBeInstanceOf(ForbiddenException);
  });
});

describe('Liquidación del negocio (HU-025)', () => {
  it('acredita solo lo vendido en eventos cerrados; lo de eventos en curso queda pendiente', async () => {
    const n = await liquidacion();
    expect(n).toMatchObject({
      acreditado: '72.00',
      pendienteCierre: '10.00',
      retirado: '0.00',
      disponible: '72.00',
    });
  });

  it('considera cerrado un evento FINALIZADO, CANCELADO o con su último día ya pasado', async () => {
    const n = await liquidacion();
    const cerrado = Object.fromEntries(n.eventos.map((e) => [e.eventoId, e.cerrado]));
    expect(cerrado).toEqual({
      [eventos.finalizado]: true,
      [eventos.pasado]: true,
      [eventos.cancelado]: true,
      [esc.eventos.abierto]: false,
    });
  });

  it('no deja ver ni retirar el negocio de otro dueño (403)', async () => {
    expect(await capturar(ventas.liquidacion(esc.usuarios.jefeOtroNegocio, esc.negocioId))).toBeInstanceOf(
      ForbiddenException,
    );
    expect(await capturar(ventas.solicitarRetiro(esc.usuarios.jefeOtroNegocio, esc.negocioId))).toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('Flujo de un retiro: solicitud → aprobación → pago', () => {
  let retiroId: string;

  it('el dueño solicita el retiro de todo lo disponible', async () => {
    const r = await ventas.solicitarRetiro(esc.usuarios.jefe, esc.negocioId);
    retiroId = r.id;
    expect(r).toMatchObject({ monto: '72.00', estado: 'SOLICITADO' });
    expect(await liquidacion()).toMatchObject({ retirado: '72.00', disponible: '0.00' });
  });

  it('no puede volver a solicitar si no queda nada disponible', async () => {
    const err = await capturar(ventas.solicitarRetiro(esc.usuarios.jefe, esc.negocioId));
    expect(err).toBeInstanceOf(BadRequestException);
    expect(mensaje(err)).toBe('No hay ventas de eventos cerrados disponibles para retirar.');
  });

  it('el administrador ve la solicitud con el negocio y su dueño', async () => {
    const lista = await retiros.listar('SOLICITADO');
    expect(lista.retiros.find((r) => r.id === retiroId)).toMatchObject({
      monto: '72.00',
      estado: 'SOLICITADO',
      negocio: `[PRUEBA-AUTO] Puesto ${sufijo.toUpperCase()}`,
      dueno: 'Prueba jefe Auto',
      email: `jefe.${sufijo}@pruebas.eventix.test`,
    });
    expect(lista.resumen.map((r) => r.estado)).toEqual(['SOLICITADO', 'APROBADO', 'PAGADO', 'RECHAZADO']);
  });

  it('no se puede pagar un retiro que no fue aprobado', async () => {
    const err = await capturar(retiros.pagar(retiroId, comprobante));
    expect(err).toBeInstanceOf(ConflictException);
    expect(mensaje(err)).toBe('Solo se puede registrar el pago de un retiro aprobado.');
  });

  it('el administrador lo aprueba (y no puede aprobarlo dos veces)', async () => {
    expect(await retiros.cambiarEstado(retiroId, 'APROBADO')).toMatchObject({ estado: 'APROBADO' });
    const err = await capturar(retiros.cambiarEstado(retiroId, 'APROBADO'));
    expect(err).toBeInstanceOf(ConflictException);
    expect(mensaje(err)).toBe('No se puede pasar un retiro APROBADO a APROBADO.');
  });

  it('exige el comprobante para registrar el pago', async () => {
    const err = await capturar(retiros.pagar(retiroId, undefined));
    expect(err).toBeInstanceOf(BadRequestException);
  });

  it('registra el pago con el comprobante (guardado en la carpeta "retiros")', async () => {
    storage.upload.mockClear();
    const r = await retiros.pagar(retiroId, comprobante);
    expect(r).toMatchObject({
      estado: 'PAGADO',
      evidenciaUrl: 'https://comprobantes.prueba.test/retiro.png',
    });
    expect(storage.upload).toHaveBeenCalledWith(comprobante, 'retiros', 'imageOrPdf');
    expect(await liquidacion()).toMatchObject({ retirado: '72.00', disponible: '0.00' });
  });

  it('un retiro pagado ya no se puede rechazar', async () => {
    const err = await capturar(retiros.cambiarEstado(retiroId, 'RECHAZADO'));
    expect(err).toBeInstanceOf(ConflictException);
    expect(mensaje(err)).toBe('No se puede pasar un retiro PAGADO a RECHAZADO.');
  });

  it('responde 404 con un retiro que no existe', async () => {
    expect(await capturar(retiros.cambiarEstado('no-existe-prueba-auto', 'APROBADO'))).toBeInstanceOf(
      NotFoundException,
    );
    expect(await capturar(retiros.pagar('no-existe-prueba-auto', comprobante))).toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('Rechazos y solicitudes simultáneas', () => {
  beforeAll(async () => {
    // Nueva venta en el evento finalizado: quedan Bs 8 disponibles para retirar.
    await registrarVenta(prisma, esc, {
      eventoId: eventos.finalizado,
      fecha: instanteLaPaz(diaLaPaz(1), '19:00'),
      items: [{ productoId: esc.productos.limitado, cantidad: 1 }],
    });
  });

  it('rechazar un retiro devuelve el monto al disponible del negocio', async () => {
    expect(await liquidacion()).toMatchObject({ acreditado: '80.00', disponible: '8.00' });
    const r = await ventas.solicitarRetiro(esc.usuarios.jefe, esc.negocioId);
    expect(await liquidacion()).toMatchObject({ disponible: '0.00' });

    await retiros.cambiarEstado(r.id, 'RECHAZADO');
    expect(await liquidacion()).toMatchObject({ retirado: '72.00', disponible: '8.00' });
  });

  it('con dos solicitudes simultáneas solo se crea un retiro', async () => {
    const intentos = await Promise.allSettled([
      ventas.solicitarRetiro(esc.usuarios.jefe, esc.negocioId),
      ventas.solicitarRetiro(esc.usuarios.jefe, esc.negocioId),
    ]);
    expect(intentos.filter((i) => i.status === 'fulfilled')).toHaveLength(1);
    const rechazo = intentos.find((i) => i.status === 'rejected') as PromiseRejectedResult;
    expect(rechazo.reason).toBeInstanceOf(BadRequestException);
    expect(await liquidacion()).toMatchObject({ retirado: '80.00', disponible: '0.00' });
  });

  it('si otro administrador cambia el retiro mientras se sube el comprobante, no se marca como pagado y se borra el archivo', async () => {
    const [pendiente] = await prisma.retiroGanancias.findMany({
      where: { negocioId: esc.negocioId, estado: 'SOLICITADO' },
      select: { id: true },
    });
    await retiros.cambiarEstado(pendiente.id, 'APROBADO');

    storage.remove.mockClear();
    storage.upload.mockImplementationOnce(async () => {
      // Mientras "sube" el archivo, otro administrador rechaza el retiro.
      await prisma.$executeRaw(
        Prisma.sql`UPDATE RetiroGanancias SET estado = 'RECHAZADO' WHERE id = ${pendiente.id}`,
      );
      return { url: 'https://comprobantes.prueba.test/tarde.png', publicId: 'eventix/retiros/tarde', nombre: 'tarde.png' };
    });

    const err = await capturar(retiros.pagar(pendiente.id, comprobante));
    expect(err).toBeInstanceOf(ConflictException);
    expect(mensaje(err)).toBe('El retiro cambió de estado. Actualiza la lista.');
    expect(storage.remove).toHaveBeenCalledWith('eventix/retiros/tarde');
    const final = await prisma.retiroGanancias.findUniqueOrThrow({
      where: { id: pendiente.id },
      select: { estado: true, evidenciaUrl: true },
    });
    expect(final).toEqual({ estado: 'RECHAZADO', evidenciaUrl: null });
  });
});
