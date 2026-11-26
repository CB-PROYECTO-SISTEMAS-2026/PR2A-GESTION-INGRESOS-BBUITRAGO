/* eslint-disable no-console */
/**
 * Completa compras/accesos/saldos/ventas sobre una BD ya poblada con usuarios/eventos/negocios
 * (cuando el seed completo se corta a mitad).
 */
const path = require('path');
const fs = require('fs');
const { createHash, randomBytes } = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { initCloudinary, uploadImage, UNSPLASH } = require('./cloudinary');
const { newTicketCode } = require('./tickets');
const { PASSWORDS, slugEmail, dateOnly } = require('./catalog');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});
const imgCache = new Map();

async function withRetry(fn, label, attempts = 5) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = String(e?.message || e);
      const transient =
        msg.includes("Can't reach database") ||
        msg.includes('P1001') ||
        msg.includes('P1017') ||
        msg.includes('Server has closed') ||
        msg.includes('Timed out');
      console.warn(`  retry ${i}/${attempts} ${label}: ${msg.slice(0, 120)}`);
      if (!transient || i === attempts) throw e;
      await new Promise((r) => setTimeout(r, 2000 * i));
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

async function ticketPool(categoriaId) {
  const t = await prisma.ticketPool.findFirst({
    where: { categoriaId, estado: 'GENERADO' },
  });
  if (!t) return null;
  await prisma.ticketPool.update({
    where: { id: t.id },
    data: { estado: 'ASIGNADO' },
  });
  return t;
}

async function main() {
  console.log('Continuando operaciones sobre datos existentes…');
  initCloudinary();

  const clientes = await prisma.usuario.findMany({
    where: { roles: { some: { role: 'CLIENTE' } } },
    orderBy: { createdAt: 'asc' },
  });
  const encargados = await prisma.usuario.findMany({
    where: { roles: { some: { role: 'ENCARGADO_ACCESO' } } },
  });
  const recargadores = await prisma.usuario.findMany({
    where: { roles: { some: { role: 'RECARGADOR' } } },
  });
  const devoluciones = await prisma.usuario.findMany({
    where: { roles: { some: { role: 'DEVOLUCIONES' } } },
  });
  const admins = await prisma.usuario.findMany({
    where: { roles: { some: { role: 'ADMIN' } } },
  });

  const eventos = await prisma.evento.findMany({
    include: {
      fechas: { orderBy: { fecha: 'asc' } },
      categorias: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const publicados = eventos.filter((e) => e.estado === 'PUBLICADO');
  const finalizados = eventos.filter((e) => e.estado === 'FINALIZADO');

  const negocios = await prisma.negocio.findMany({
    include: {
      productos: true,
      ayudantes: { where: { estado: 'ACTIVO' }, include: { usuario: true } },
    },
  });

  const yaCompraron = new Set(
    (
      await prisma.compraEntrada.findMany({
        select: { usuarioId: true },
        distinct: ['usuarioId'],
      })
    ).map((c) => c.usuarioId),
  );

  const comp = await up('comprobantes', 'compra-shared', UNSPLASH.comprobante);
  const fotoAcc = await up('accesos', 'acceso-shared', UNSPLASH.acceso);

  let hechas = 0;
  for (let c = 0; c < clientes.length; c++) {
    const cli = clientes[c];
    if (yaCompraron.has(cli.id)) continue;

    const target = publicados[c % Math.max(1, publicados.length)] || eventos[c % eventos.length];
    if (!target?.categorias?.length || !target?.fechas?.length) continue;
    const cat = target.categorias[c % target.categorias.length];
    const fecha = target.fechas[c % target.fechas.length];
    const estadoCompra =
      c % 11 === 0 ? 'PENDIENTE' : c % 13 === 0 ? 'RECHAZADA' : 'APROBADA';
    const monto = Number(cat.precio);

    const compra = await prisma.compraEntrada.create({
      data: {
        usuarioId: cli.id,
        eventoId: target.id,
        estado: estadoCompra,
        montoTotal: monto,
        observaciones: estadoCompra === 'PENDIENTE' ? 'Pago en revisión' : null,
        reembolsoHasta:
          estadoCompra === 'APROBADA'
            ? new Date(Date.now() + (c % 5 === 0 ? -40 : 25) * 86400000)
            : null,
        items: {
          create: {
            categoriaId: cat.id,
            fechaId: fecha.id,
            cantidad: 1,
            precioUnit: cat.precio,
            paraNombre: c % 17 === 0 ? 'Invitado regalo' : null,
            paraEmail: c % 17 === 0 ? 'invitado.regalo@gmail.com' : null,
            paraTelefono: c % 17 === 0 ? '+59170111222' : null,
          },
        },
      },
      include: { items: true },
    });

    if (estadoCompra !== 'PENDIENTE') {
      await prisma.pagoQR.create({
        data: {
          compraId: compra.id,
          referencia: `REF-${compra.id.slice(-8)}`,
          comprobanteUrl: comp.url,
          monto,
        },
      });
    }

    if (estadoCompra === 'APROBADA') {
      const ticket = await ticketPool(cat.id);
      const codigo = ticket?.codigo || newTicketCode();
      const entrada = await prisma.entrada.create({
        data: {
          compraId: compra.id,
          eventoId: target.id,
          categoriaId: cat.id,
          fechaId: fecha.id,
          titularId: c % 17 === 0 ? null : cli.id,
          ticketPoolId: ticket?.id ?? null,
          codigoQr: codigo,
          codigo,
          estado: c % 19 === 0 ? 'REEMBOLSADA' : 'ASIGNADA',
        },
      });
      if (c % 17 === 0) {
        await prisma.compraEntradaItem.update({
          where: { id: compra.items[0].id },
          data: { entradaId: entrada.id },
        });
      }
      if (['QR_DIGITAL', 'AMBOS'].includes(target.tipoAcceso)) {
        await prisma.credencial.create({
          data: { entradaId: entrada.id, codigoQr: codigo, activa: true },
        });
      }
      const enc = encargados[c % Math.max(1, encargados.length)];
      if (c % 4 !== 1 && enc) {
        await prisma.accesoEvento.create({
          data: {
            eventoId: target.id,
            entradaId: entrada.id,
            fechaId: fecha.id,
            encargadoId: enc.id,
            tipo: 'INGRESO',
            fotoIngresoUrl: fotoAcc.url,
          },
        });
      }
      if (c % 7 === 2 && enc) {
        await prisma.accesoEvento.create({
          data: {
            eventoId: target.id,
            entradaId: entrada.id,
            fechaId: fecha.id,
            encargadoId: enc.id,
            tipo: 'SALIDA',
          },
        });
      }
      if (c % 8 === 4 && c % 19 !== 0) {
        await prisma.reembolsoEntrada.create({
          data: {
            entradaId: entrada.id,
            usuarioId: cli.id,
            motivo: 'No pudo asistir al evento',
            estado: ['SOLICITADO', 'APROBADO', 'PAGADO', 'RECHAZADO'][c % 4],
            monto,
          },
        });
      }
    }

    hechas++;
    if (hechas % 10 === 0) console.log(`  compras nuevas: ${hechas}`);
  }
  console.log(`Compras nuevas: ${hechas}`);

  // Saldos + ventas si faltan
  if (
    (await withRetry(() => prisma.venta.count(), 'venta.count')) === 0 &&
    negocios[0] &&
    publicados[0] &&
    clientes[0]
  ) {
    console.log('Creando saldos y ventas…');
    const ev = publicados[0];
    const neg = negocios[0];
    const ay = neg.ayudantes[0]?.usuario;
    const rec = recargadores[0];
    if (ay && rec && neg.productos.length) {
      let saldo = await prisma.saldoEvento.upsert({
        where: {
          usuarioId_eventoId: { usuarioId: clientes[0].id, eventoId: ev.id },
        },
        create: { usuarioId: clientes[0].id, eventoId: ev.id, saldo: 250 },
        update: { saldo: 250 },
      });
      await prisma.transaccionSaldo.create({
        data: {
          saldoEventoId: saldo.id,
          usuarioId: clientes[0].id,
          eventoId: ev.id,
          operadorId: rec.id,
          tipo: 'RECARGA',
          monto: 250,
          saldoResultante: 250,
          estado: 'COMPLETADA',
          nota: 'Recarga inicial',
        },
      });
      for (let v = 0; v < 6; v++) {
        const prod = neg.productos[v % neg.productos.length];
        const qty = 1 + (v % 3);
        const sub = Number(prod.precio) * qty;
        saldo = await prisma.saldoEvento.update({
          where: { id: saldo.id },
          data: { saldo: { decrement: sub } },
        });
        const venta = await prisma.venta.create({
          data: {
            negocioId: neg.id,
            eventoId: ev.id,
            ayudanteId: ay.id,
            clienteId: clientes[0].id,
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
            usuarioId: clientes[0].id,
            eventoId: ev.id,
            operadorId: rec.id,
            tipo: 'COMPRA_PRODUCTO',
            monto: sub,
            saldoResultante: saldo.saldo,
            ventaId: venta.id,
            estado: 'COMPLETADA',
          },
        });
      }
    }

    for (let s = 2; s < Math.min(15, clientes.length); s++) {
      const evS = publicados[s % publicados.length];
      if (!evS) continue;
      const exists = await prisma.saldoEvento.findUnique({
        where: {
          usuarioId_eventoId: { usuarioId: clientes[s].id, eventoId: evS.id },
        },
      });
      if (exists) continue;
      const saldoRow = await prisma.saldoEvento.create({
        data: {
          usuarioId: clientes[s].id,
          eventoId: evS.id,
          saldo: 20 + s * 3,
        },
      });
      await prisma.transaccionSaldo.create({
        data: {
          saldoEventoId: saldoRow.id,
          usuarioId: clientes[s].id,
          eventoId: evS.id,
          operadorId: recargadores[s % recargadores.length]?.id,
          tipo: 'RECARGA',
          monto: saldoRow.saldo,
          saldoResultante: saldoRow.saldo,
          estado: 'COMPLETADA',
        },
      });
    }

    if (finalizados[0] && clientes[70] && devoluciones[0]) {
      const evR = finalizados[finalizados.length - 1] || finalizados[0];
      const exists = await prisma.saldoEvento.findUnique({
        where: {
          usuarioId_eventoId: { usuarioId: clientes[70].id, eventoId: evR.id },
        },
      });
      if (!exists) {
        const saldoDev = await prisma.saldoEvento.create({
          data: { usuarioId: clientes[70].id, eventoId: evR.id, saldo: 45 },
        });
        await prisma.transaccionSaldo.create({
          data: {
            saldoEventoId: saldoDev.id,
            usuarioId: clientes[70].id,
            eventoId: evR.id,
            operadorId: devoluciones[0].id,
            tipo: 'DEVOLUCION',
            monto: 40,
            saldoResultante: 45,
            estado: 'COMPLETADA',
            nota: 'Devolución parcial de saldo no consumido',
          },
        });
      }
    }
    if (finalizados[0] && clientes[71]) {
      await prisma.saldoEvento.upsert({
        where: {
          usuarioId_eventoId: {
            usuarioId: clientes[71].id,
            eventoId: finalizados[0].id,
          },
        },
        create: {
          usuarioId: clientes[71].id,
          eventoId: finalizados[0].id,
          saldo: 120,
        },
        update: {},
      });
    }
  }

  if ((await prisma.invitacionUsuario.count()) === 0 && admins[0]) {
    const invites = [
      { nombre: 'Gonzalo', apellido: 'Ramos', role: 'ORGANIZADOR' },
      { nombre: 'Carla', apellido: 'Méndez', role: 'ENCARGADO_ACCESO' },
      { nombre: 'Felipe', apellido: 'Ortiz', role: 'RECARGADOR' },
    ];
    for (let i = 0; i < invites.length; i++) {
      const inv = invites[i];
      await prisma.invitacionUsuario.create({
        data: {
          email: slugEmail(inv.nombre, inv.apellido, inv.role, 99),
          nombre: inv.nombre,
          apellido: inv.apellido,
          telefono: `+5916${8500000 + i}`,
          role: inv.role,
          tokenHash: createHash('sha256').update(randomBytes(16)).digest('hex'),
          expiresAt: dateOnly('2027-02-28'),
          estado: 'PENDIENTE',
          creadoPorId: admins[0].id,
        },
      });
    }
  }

  // Credenciales de login (muestra)
  const logins = {};
  for (const role of Object.keys(PASSWORDS)) {
    const sample = await prisma.usuario.findMany({
      where: { roles: { some: { role } } },
      take: 3,
      select: { email: true, nombre: true, apellido: true },
      orderBy: { createdAt: 'asc' },
    });
    logins[role] = sample.map((u) => ({
      email: u.email,
      password: PASSWORDS[role],
      nombre: `${u.nombre} ${u.apellido || ''}`.trim(),
    }));
  }
  fs.writeFileSync(
    path.join(__dirname, 'credenciales.local.json'),
    JSON.stringify({ passwords: PASSWORDS, logins }, null, 2),
  );

  const counts = {
    usuarios: await prisma.usuario.count(),
    eventos: await prisma.evento.count(),
    compras: await prisma.compraEntrada.count(),
    entradas: await prisma.entrada.count(),
    accesos: await prisma.accesoEvento.count(),
    negocios: await prisma.negocio.count(),
    ventas: await prisma.venta.count(),
    saldos: await prisma.saldoEvento.count(),
    reembolsos: await prisma.reembolsoEntrada.count(),
    invitaciones: await prisma.invitacionUsuario.count(),
  };
  console.log('\n=== Resumen ===');
  console.log(counts);
  console.log('\nContraseñas por rol:');
  for (const [r, pw] of Object.entries(PASSWORDS)) console.log(`  ${r}: ${pw}`);
  console.log('\nEjemplos:');
  for (const [r, items] of Object.entries(logins)) {
    if (items[0]) console.log(`  ${r}: ${items[0].email}`);
  }
  console.log('\nContinuación finalizada.');
}

main()
  .catch((e) => {
    console.error('Continuación falló:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
