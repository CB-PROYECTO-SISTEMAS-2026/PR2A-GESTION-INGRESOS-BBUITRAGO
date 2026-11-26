/* eslint-disable no-console */
/** Completa huecos operativos: más ventas/saldos, reembolsos PAGADO con evidencia, cobertura. */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { initCloudinary, uploadImage, UNSPLASH } = require('./cloudinary');

const prisma = new PrismaClient();
const imgCache = new Map();

async function withRetry(fn, label, attempts = 5) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e?.message || e);
      const ok =
        msg.includes("Can't reach") ||
        msg.includes('P1001') ||
        msg.includes('P1017') ||
        msg.includes('Timed out');
      console.warn(`retry ${i} ${label}: ${msg.slice(0, 100)}`);
      if (!ok || i === attempts) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  throw last;
}

async function up(sub, key, url) {
  return uploadImage({
    baseFolder: initCloudinary(),
    subfolder: sub,
    sourceUrl: url,
    cache: imgCache,
    key,
  });
}

async function main() {
  initCloudinary();
  const evidencia = await up('reembolsos', 'reembolso-pago', UNSPLASH.comprobante);

  const clientes = await withRetry(
    () =>
      prisma.usuario.findMany({
        where: { roles: { some: { role: 'CLIENTE' } } },
        orderBy: { createdAt: 'asc' },
      }),
    'clientes',
  );
  const recargadores = await prisma.usuario.findMany({
    where: { roles: { some: { role: 'RECARGADOR' } } },
  });
  const admins = await prisma.usuario.findMany({
    where: { roles: { some: { role: 'ADMIN' } } },
  });

  const publicados = await prisma.evento.findMany({
    where: { estado: { in: ['PUBLICADO', 'FINALIZADO'] } },
    include: { fechas: true },
    orderBy: { createdAt: 'asc' },
  });

  const negocios = await prisma.negocio.findMany({
    include: {
      productos: true,
      ayudantes: { where: { estado: 'ACTIVO' }, include: { usuario: true } },
      solicitudes: { where: { estado: 'ACEPTADA' } },
    },
  });

  // Ventas en varios negocios/eventos aceptados
  let ventasNuevas = 0;
  for (let i = 0; i < negocios.length; i++) {
    const neg = negocios[i];
    const ay = neg.ayudantes[0]?.usuario;
    if (!ay || !neg.productos.length) continue;
    const sol = neg.solicitudes[0];
    const ev =
      publicados.find((e) => e.id === sol?.eventoId) || publicados[i % publicados.length];
    if (!ev) continue;
    const cli = clientes[(i * 3) % clientes.length];
    const rec = recargadores[i % recargadores.length];

    let saldo = await prisma.saldoEvento.upsert({
      where: { usuarioId_eventoId: { usuarioId: cli.id, eventoId: ev.id } },
      create: { usuarioId: cli.id, eventoId: ev.id, saldo: 180 },
      update: {},
    });
    if (Number(saldo.saldo) < 50) {
      saldo = await prisma.saldoEvento.update({
        where: { id: saldo.id },
        data: { saldo: { increment: 150 } },
      });
      await prisma.transaccionSaldo.create({
        data: {
          saldoEventoId: saldo.id,
          usuarioId: cli.id,
          eventoId: ev.id,
          operadorId: rec?.id,
          tipo: 'RECARGA',
          monto: 150,
          saldoResultante: saldo.saldo,
          estado: 'COMPLETADA',
        },
      });
    }

    const existentes = await prisma.venta.count({
      where: { negocioId: neg.id, eventoId: ev.id },
    });
    if (existentes >= 3) continue;

    for (let v = 0; v < 3 - existentes; v++) {
      const prod = neg.productos[v % neg.productos.length];
      const qty = 1 + (v % 2);
      const sub = Number(prod.precio) * qty;
      if (Number(saldo.saldo) < sub) break;
      saldo = await prisma.saldoEvento.update({
        where: { id: saldo.id },
        data: { saldo: { decrement: sub } },
      });
      const venta = await prisma.venta.create({
        data: {
          negocioId: neg.id,
          eventoId: ev.id,
          ayudanteId: ay.id,
          clienteId: cli.id,
          total: sub,
          detalles: {
            create: {
              productoId: prod.id,
              cantidad: qty,
              precioUnit: prod.precio,
              subtotal: sub,
            },
          },
        },
      });
      await prisma.transaccionSaldo.create({
        data: {
          saldoEventoId: saldo.id,
          usuarioId: cli.id,
          eventoId: ev.id,
          operadorId: rec?.id,
          tipo: 'COMPRA_PRODUCTO',
          monto: sub,
          saldoResultante: saldo.saldo,
          ventaId: venta.id,
          estado: 'COMPLETADA',
        },
      });
      ventasNuevas++;
    }
  }
  console.log('Ventas nuevas:', ventasNuevas);

  // Reembolsos PAGADO con evidencia
  const pagados = await prisma.reembolsoEntrada.findMany({
    where: { estado: 'PAGADO', OR: [{ evidenciaUrl: null }, { evidenciaUrl: '' }] },
  });
  for (const r of pagados) {
    await prisma.reembolsoEntrada.update({
      where: { id: r.id },
      data: {
        evidenciaUrl: evidencia.url,
        pagadoAt: new Date(),
        pagadoPorId: admins[0]?.id ?? null,
      },
    });
  }
  console.log('Reembolsos PAGADO con evidencia:', pagados.length);

  // Cliente sin fila saldo explícita en un evento publicado (además de los que tienen)
  const sinSaldoCli = clientes[1];
  const evPub = publicados.find((e) => e.estado === 'PUBLICADO') || publicados[0];
  if (sinSaldoCli && evPub) {
    const row = await prisma.saldoEvento.findUnique({
      where: {
        usuarioId_eventoId: { usuarioId: sinSaldoCli.id, eventoId: evPub.id },
      },
    });
    if (row && Number(row.saldo) === 0) {
      console.log('Cliente con saldo 0 OK:', sinSaldoCli.email);
    }
  }

  // Cobertura de días 15/11–15/01
  const fechas = await prisma.fechaEvento.findMany({ select: { fecha: true } });
  const set = new Set(
    fechas.map((f) => new Date(f.fecha).toISOString().slice(0, 10)),
  );
  const gaps = [];
  let d = new Date(Date.UTC(2026, 10, 15));
  const end = new Date(Date.UTC(2027, 0, 15));
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    if (!set.has(iso)) gaps.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  console.log('Días sin evento en ventana:', gaps.length, gaps.slice(0, 8));

  // Si hay huecos, extender un evento PUBLICADO cercano (añadir FechaEvento)
  if (gaps.length) {
    const filler = publicados.find((e) => e.estado === 'PUBLICADO') || publicados[0];
    const cats = await prisma.categoriaEntrada.findMany({
      where: { eventoId: filler.id },
    });
    for (const iso of gaps) {
      const [y, m, day] = iso.split('-').map(Number);
      const fecha = new Date(Date.UTC(y, m - 1, day));
      const fe = await prisma.fechaEvento.upsert({
        where: { eventoId_fecha: { eventoId: filler.id, fecha } },
        create: {
          eventoId: filler.id,
          fecha,
          horaInicio: '10:00',
          horaFin: '22:00',
        },
        update: {},
      });
      for (const cat of cats) {
        await prisma.categoriaFecha.upsert({
          where: {
            categoriaId_fechaId: { categoriaId: cat.id, fechaId: fe.id },
          },
          create: { categoriaId: cat.id, fechaId: fe.id, disponible: true },
          update: {},
        });
      }
    }
    console.log('Huecos cubiertos con fechas de:', filler.titulo);
  }

  const counts = {
    usuarios: await prisma.usuario.count(),
    eventos: await prisma.evento.count(),
    fechas: await prisma.fechaEvento.count(),
    compras: await prisma.compraEntrada.count(),
    entradas: await prisma.entrada.count(),
    accesos: await prisma.accesoEvento.count(),
    negocios: await prisma.negocio.count(),
    ventas: await prisma.venta.count(),
    saldos: await prisma.saldoEvento.count(),
    transacciones: await prisma.transaccionSaldo.count(),
    reembolsos: await prisma.reembolsoEntrada.count(),
    manillas: await prisma.manilla.count(),
    liquidaciones: await prisma.liquidacionEvento.count(),
    retiros: await prisma.retiroGanancias.count(),
    invitaciones: await prisma.invitacionUsuario.count(),
  };
  console.log('\n=== Resumen 100% ===');
  console.log(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
