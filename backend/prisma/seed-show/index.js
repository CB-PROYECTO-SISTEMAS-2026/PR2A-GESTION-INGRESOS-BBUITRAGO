/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { createHash, randomBytes } = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');

const { wipeAll } = require('./wipe');
const { initCloudinary, uploadImage, UNSPLASH } = require('./cloudinary');
const { buildPoolRows, newTicketCode } = require('./tickets');
const {
  PASSWORDS,
  NOMBRES,
  APELLIDOS,
  NEGOCIOS,
  planEventos,
  dateOnly,
  addDays,
  slugEmail,
} = require('./catalog');

const prisma = new PrismaClient();
const imgCache = new Map();
const loginPorRol = {};
const globalCodes = new Set();

function pick(arr, i) {
  return arr[i % arr.length];
}

function phoneFor(i) {
  const n = 60000000 + i;
  return `+591${n}`;
}

function ciFor(i) {
  return `${1000000 + i}CB`;
}

async function hash(pw) {
  return bcrypt.hash(pw, 10);
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

async function crearUsuarios() {
  const specs = [
    { role: 'ADMIN', count: 2 },
    { role: 'ORGANIZADOR', count: 6 },
    { role: 'CLIENTE', count: 80 },
    { role: 'JEFE_NEGOCIO', count: 12 },
    { role: 'ENCARGADO_ACCESO', count: 15 },
    { role: 'RECARGADOR', count: 15 },
    { role: 'DEVOLUCIONES', count: 10 },
  ];
  const byRole = {};
  let idx = 0;
  for (const spec of specs) {
    const list = [];
    const pw = await hash(PASSWORDS[spec.role]);
    for (let i = 0; i < spec.count; i++) {
      const nombre = pick(NOMBRES, idx + i);
      const apellido = pick(APELLIDOS, idx + i + 3);
      const email = slugEmail(nombre, apellido, spec.role, i);
      const u = await prisma.usuario.create({
        data: {
          email,
          passwordHash: pw,
          nombre,
          apellido,
          telefono: phoneFor(idx),
          documento: ciFor(idx),
          fechaNac: dateOnly('1990-05-12'),
          activo: true,
          roles: { create: { role: spec.role } },
        },
      });
      if (!loginPorRol[spec.role]) loginPorRol[spec.role] = [];
      if (i < 3) loginPorRol[spec.role].push({ email, password: PASSWORDS[spec.role] });
      list.push(u);
      idx++;
    }
    byRole[spec.role] = list;
  }
  return byRole;
}

function diasEntre(inicio, fin) {
  const out = [];
  let c = inicio;
  while (c <= fin) {
    out.push(c);
    c = addDays(c, 1);
  }
  return out;
}

async function crearEventos(organizadores, staffPools, baseFolder) {
  const planes = planEventos();
  const eventos = [];
  const fechasPorEvento = new Map();
  const catsPorEvento = new Map();

  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];
    const org = organizadores[i % organizadores.length];
    const flyerSrc =
      i % 5 === 0
        ? UNSPLASH.feria
        : i % 5 === 1
          ? UNSPLASH.teatro
          : i % 5 === 2
            ? UNSPLASH.evento
            : UNSPLASH.concierto;
    const flyer = await up('eventos', `evt-flyer-${i % 5}`, flyerSrc);
    const mapa = await up('mapas', `evt-map-${i % 3}`, UNSPLASH.mapa);

    const sol = await prisma.solicitudEvento.create({
      data: {
        organizadorId: org.id,
        nombreEvento: p.titulo,
        descripcion: `Vive ${p.titulo} en Cochabamba. Producción EvenTix Bolivia con cupos limitados.`,
        ubicacion: p.ubicacion,
        ubicacionUrl: 'https://maps.google.com/?q=Cochabamba',
        capacidad: 800 + (i % 5) * 100,
        empresa: 'EvenTix CBBA',
        fechaInicio: dateOnly(p.inicio),
        fechaFin: dateOnly(p.fin),
        horaInicio: '18:00',
        horaFin: '23:30',
        mapaUrl: mapa.url,
        mapaNombre: 'Plano general.jpg',
        estado: p.estado === 'BORRADOR' ? 'APROBADA' : 'EVENTO_CREADO',
        reembolsoHoras: 48,
        mapHistory: {
          create: {
            mapaUrl: mapa.url,
            mapaNombre: 'Plano inicial',
            tipo: 'CREACION',
            nota: 'Carga inicial del mapa',
          },
        },
      },
    });

    const qrPago = await up('comprobantes', 'qr-pago-shared', UNSPLASH.comprobante);

    const evt = await prisma.evento.create({
      data: {
        solicitudId: sol.id,
        organizadorId: org.id,
        titulo: p.titulo,
        descripcion: sol.descripcion,
        fotoUrl: flyer.url,
        fotoPublicId: flyer.publicId,
        ubicacion: p.ubicacion,
        ubicacionUrl: sol.ubicacionUrl,
        servicios: ['Estacionamiento', 'Baños', 'Primeros auxilios'],
        cronograma: {
          apertura: '18:00',
          cierre: '23:30',
          actividades: [
            { hora: '18:30', actividad: 'Apertura de puertas' },
            { hora: '20:00', actividad: 'Show principal' },
          ],
        },
        tipoAcceso: p.tipo,
        estado: p.estado,
        mapaUrl: mapa.url,
        capacidad: sol.capacidad,
        puntoRetiroManilla: p.tipo !== 'QR_DIGITAL' ? 'Caseta Norte – FEXCO' : null,
        horarioRetiroManilla: p.tipo !== 'QR_DIGITAL' ? '17:00 – 19:30' : null,
        qrPagoUrl: qrPago.url,
        qrPagoPublicId: qrPago.publicId,
        instruccionesPago: 'Escanea el QR y sube tu comprobante para validación.',
        reembolsoHoras: 48,
        mapHistory: {
          create: {
            mapaUrl: mapa.url,
            mapaNombre: 'Plano publicado',
            tipo: 'CREACION',
          },
        },
      },
    });

    const dias = diasEntre(p.inicio, p.fin);
    const fechas = [];
    for (const d of dias) {
      fechas.push(
        await prisma.fechaEvento.create({
          data: {
            eventoId: evt.id,
            fecha: dateOnly(d),
            horaInicio: '18:00',
            horaFin: '23:30',
          },
        }),
      );
    }
    fechasPorEvento.set(evt.id, fechas);

    const nombresCat = ['General', 'Preferencial', 'VIP'];
    const cats = [];
    for (let c = 0; c < 3; c++) {
      // Cupo moderado: multi-día multiplica el pool (cupo × días).
      const cupo = 25 + ((i + c * 11) % 36);
      const cat = await prisma.categoriaEntrada.create({
        data: {
          eventoId: evt.id,
          nombre: nombresCat[c],
          precio: 35 + c * 25 + (i % 4) * 5,
          descuento: c === 0 ? 0 : 10,
          beneficios: c === 2 ? ['Meet & greet', 'Bebida incluida'] : ['Acceso estándar'],
          cupo,
        },
      });
      cats.push(cat);
      for (const f of fechas) {
        await prisma.categoriaFecha.create({
          data: { categoriaId: cat.id, fechaId: f.id, disponible: p.estado !== 'CANCELADO' },
        });
      }
      const poolSize = cupo * Math.max(1, fechas.length);
      const rows = buildPoolRows(cat.id, poolSize, globalCodes);
      for (let off = 0; off < rows.length; off += 400) {
        await prisma.ticketPool.createMany({ data: rows.slice(off, off + 400) });
      }
    }
    catsPorEvento.set(evt.id, cats);

    const enc = staffPools.encargados[i % staffPools.encargados.length];
    const rec = staffPools.recargadores[i % staffPools.recargadores.length];
    const dev = staffPools.devoluciones[i % staffPools.devoluciones.length];
    await prisma.staffEvento.createMany({
      data: [
        { usuarioId: enc.id, eventoId: evt.id, role: 'ENCARGADO_ACCESO' },
        { usuarioId: rec.id, eventoId: evt.id, role: 'RECARGADOR' },
        { usuarioId: dev.id, eventoId: evt.id, role: 'DEVOLUCIONES' },
      ],
    });

    if (p.tipo !== 'QR_DIGITAL') {
      const punto = await prisma.puntoRetiroManilla.create({
        data: {
          eventoId: evt.id,
          nombre: 'Punto Central',
          ubicacion: 'Ingreso principal',
          horario: '17:00 – 22:00',
          activo: true,
        },
      });
      await prisma.supervisorPuntoRetiro.create({
        data: { puntoRetiroId: punto.id, usuarioId: enc.id, activo: true },
      });
      for (let m = 0; m < 8; m++) {
        await prisma.manilla.create({
          data: {
            eventoId: evt.id,
            codigoFisico: `MAN-${evt.id.slice(-4)}-${m + 1}`.toUpperCase(),
            vinculada: false,
            puntoRetiroId: punto.id,
          },
        });
      }
    }

    if (['FINALIZADO', 'CANCELADO'].includes(p.estado) && i % 3 === 0) {
      await prisma.liquidacionEvento.create({
        data: {
          eventoId: evt.id,
          montoTotal: 12500 + i * 340,
          estado: p.estado === 'FINALIZADO' ? 'ENTREGADA' : 'RECHAZADA',
          nota: 'Liquidación cerrada tras el evento',
        },
      });
    }

    await prisma.incidenciaEvento.create({
      data: {
        eventoId: evt.id,
        autorId: org.id,
        clave: `INC-${i + 1}`,
        descripcion: 'Retraso menor en apertura de puertas.',
        resolucion: 'Se abrió acceso alternativo.',
        resueltaAt: new Date(),
      },
    });

    eventos.push({ evt, plan: p, fechas, cats, org });
  }
  return { eventos, fechasPorEvento, catsPorEvento };
}

async function crearNegocios(jefes, eventosPublicados, admin) {
  const negocios = [];
  for (let i = 0; i < NEGOCIOS.length; i++) {
    const def = NEGOCIOS[i];
    const jefe = jefes[i];
    const logo = await up('negocios', 'neg-logo-shared', i % 2 ? UNSPLASH.bebida : UNSPLASH.negocio);
    const evt = eventosPublicados[i % eventosPublicados.length];

    const neg = await prisma.negocio.create({
      data: {
        duenoId: jefe.id,
        nombre: def.nombre,
        descripcion: `${def.nombre} atendiendo en eventos masivos de Cochabamba.`,
        ciudad: 'Cochabamba',
        direccion: `Av. América ${120 + i}, Cochabamba`,
        emailContacto: jefe.email,
        logoUrl: logo.url,
        logoPublicId: logo.publicId,
        matriculaComercio: `MC-${10000 + i}`,
        nit: def.nit,
        razonSocial: def.razonSocial,
        representanteNombre: `${jefe.nombre} ${jefe.apellido}`,
        representanteDocumento: ciFor(500 + i),
        rubro: def.rubro,
        telefono: phoneFor(900 + i),
        tipoSociedad: i % 2 ? 'SRL' : 'UNIPERSONAL',
        eventoId: evt.evt.id,
      },
    });

    await prisma.solicitudNegocio.create({
      data: {
        negocioId: neg.id,
        eventoId: evt.evt.id,
        estado: 'ACEPTADA',
        mensaje: `Solicitud de stand para ${def.nombre}.`,
        respuesta: 'Participación aceptada',
        respondidoPorId: admin.id,
        respondidoAt: new Date(),
      },
    });
    if (eventosPublicados.length > 1) {
      const otro = eventosPublicados[(i + 3) % eventosPublicados.length];
      if (otro.evt.id !== evt.evt.id) {
        await prisma.solicitudNegocio.create({
          data: {
            negocioId: neg.id,
            eventoId: otro.evt.id,
            estado: i % 2 === 0 ? 'PENDIENTE' : 'RECHAZADA',
            mensaje: 'Solicitud adicional de participación.',
            respuesta: i % 2 === 0 ? null : 'Cupo de stands completo',
            respondidoPorId: i % 2 === 0 ? null : admin.id,
            respondidoAt: i % 2 === 0 ? null : new Date(),
          },
        });
      }
    }

    const rolCajero = await prisma.rolNegocio.create({
      data: {
        negocioId: neg.id,
        nombre: 'Cajero',
        descripcion: 'Venta en punto de venta',
      },
    });
  await prisma.rolNegocio.create({
      data: { negocioId: neg.id, nombre: 'Supervisor', descripcion: 'Cierre de caja' },
    });

    const productosBase = [
      ['Combo clásico', 'COMIDA', 28],
      ['Gaseosa 500ml', 'BEBIDA', 12],
      ['Agua mineral', 'BEBIDA', 8],
      ['Snack papas', 'SNACK', 10],
      ['Postre brownie', 'POSTRE', 15],
      ['Souvenir evento', 'MERCHANDISING', 35],
    ];
    const productos = [];
    for (const [nombre, cat, precio] of productosBase) {
      productos.push(
        await prisma.producto.create({
          data: {
            negocioId: neg.id,
            nombre,
            precio,
            descripcion: `${nombre} – ${def.nombre}`,
            categoria: cat,
            stock: 80 + i * 5,
            activo: true,
          },
        }),
      );
    }

    const numAyudantes = 2 + (i % 4);
    const ayudantes = [];
    const ayPw = await hash(PASSWORDS.AYUDANTE);
    for (let a = 0; a < numAyudantes; a++) {
      const nombre = pick(NOMBRES, i * 3 + a);
      const apellido = pick(APELLIDOS, i + a + 2);
      const email = slugEmail(nombre, apellido, 'AYUDANTE', i * 10 + a);
      const u = await prisma.usuario.create({
        data: {
          email,
          passwordHash: ayPw,
          nombre,
          apellido,
          telefono: phoneFor(2000 + i * 10 + a),
          documento: ciFor(2000 + i * 10 + a),
          activo: true,
          roles: { create: { role: 'AYUDANTE' } },
        },
      });
      if (!loginPorRol.AYUDANTE) loginPorRol.AYUDANTE = [];
      if (loginPorRol.AYUDANTE.length < 3)
        loginPorRol.AYUDANTE.push({ email, password: PASSWORDS.AYUDANTE });

      const estado = a === numAyudantes - 1 && i % 3 === 0 ? 'INACTIVO' : 'ACTIVO';
      const ay = await prisma.ayudanteNegocio.create({
        data: {
          negocioId: neg.id,
          usuarioId: u.id,
          jefeId: jefe.id,
          estado,
          rolId: rolCajero.id,
          rolFuncion: 'cajero',
          activo: estado === 'ACTIVO',
        },
      });
      await prisma.invitacionAyudante.create({
        data: {
          ayudanteId: ay.id,
          tokenHash: createHash('sha256').update(randomBytes(24)).digest('hex'),
          expiraAt: dateOnly('2027-02-15'),
          estado: 'ACEPTADA',
          aceptadaAt: new Date(),
        },
      });
      ayudantes.push({ u, ay });
    }

    if (i % 4 === 0) {
      await prisma.retiroGanancias.create({
        data: {
          negocioId: neg.id,
          monto: 450 + i * 80,
          estado: i % 8 === 0 ? 'PAGADO' : 'SOLICITADO',
          evidenciaUrl: (await up('comprobantes', 'retiro-shared', UNSPLASH.comprobante)).url,
        },
      });
    }

    negocios.push({ neg, productos, ayudantes, jefe, evt });
  }
  return negocios;
}

async function tomarTicket(categoriaId) {
  const t = await prisma.ticketPool.findFirst({
    where: { categoriaId, estado: 'GENERADO' },
  });
  if (!t) return null;
  await prisma.ticketPool.update({ where: { id: t.id }, data: { estado: 'ASIGNADO' } });
  return t;
}

async function crearComprasYOperaciones(clientes, eventos, negocios, staff) {
  const publicados = eventos.filter((e) => e.plan.estado === 'PUBLICADO');
  const finalizados = eventos.filter((e) => e.plan.estado === 'FINALIZADO');
  const escenarios = [];

  for (let c = 0; c < clientes.length; c++) {
    const cli = clientes[c];
    const target = publicados[c % publicados.length] || eventos[c % eventos.length];
    const cat = target.cats[c % target.cats.length];
    const fecha = target.fechas[c % target.fechas.length];
    const estadoCompra =
      c % 11 === 0 ? 'PENDIENTE' : c % 13 === 0 ? 'RECHAZADA' : 'APROBADA';
    const monto = Number(cat.precio) * (1 + (c % 2));

    const compra = await prisma.compraEntrada.create({
      data: {
        usuarioId: cli.id,
        eventoId: target.evt.id,
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
      const comp = await up('comprobantes', 'compra-shared', UNSPLASH.comprobante);
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
      const ticket = await tomarTicket(cat.id);
      const codigo = ticket?.codigo || newTicketCode();
      const entrada = await prisma.entrada.create({
        data: {
          compraId: compra.id,
          eventoId: target.evt.id,
          categoriaId: cat.id,
          fechaId: fecha.id,
          titularId: c % 17 === 0 ? null : cli.id,
          ticketPoolId: ticket?.id ?? null,
          codigoQr: codigo,
          codigo,
          estado: c % 19 === 0 ? 'REEMBOLSADA' : 'ASIGNADA',
        },
      });
      await prisma.compraEntradaItem.update({
        where: { id: compra.items[0].id },
        data: { entradaId: c % 17 === 0 ? entrada.id : undefined },
      });

      if (['QR_DIGITAL', 'AMBOS'].includes(target.plan.tipo)) {
        await prisma.credencial.create({
          data: { entradaId: entrada.id, codigoQr: codigo, activa: true },
        });
      }

      const enc = staff.encargados[c % staff.encargados.length];
      const fotoAcc = await up('accesos', 'acceso-shared', UNSPLASH.acceso);

      if (c % 4 !== 1) {
        await prisma.accesoEvento.create({
          data: {
            eventoId: target.evt.id,
            entradaId: entrada.id,
            fechaId: fecha.id,
            encargadoId: enc.id,
            tipo: 'INGRESO',
            fotoIngresoUrl: fotoAcc.url,
          },
        });
      }
      if (c % 7 === 2) {
        await prisma.accesoEvento.create({
          data: {
            eventoId: target.evt.id,
            entradaId: entrada.id,
            fechaId: fecha.id,
            encargadoId: enc.id,
            tipo: 'SALIDA',
          },
        });
      }
      if (c % 9 === 3) {
        await prisma.accesoRechazo.create({
          data: {
            eventoId: target.evt.id,
            entradaId: entrada.id,
            fechaId: fecha.id,
            encargadoId: enc.id,
            sentido: 'ENTRADA',
            motivo: 'Documento no coincide con titular',
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

      if (target.plan.tipo !== 'QR_DIGITAL' && c % 5 === 0) {
        const man = await prisma.manilla.findFirst({
          where: { eventoId: target.evt.id, vinculada: false },
        });
        if (man) {
          await prisma.manilla.update({
            where: { id: man.id },
            data: {
              vinculada: true,
              vinculadaAt: new Date(),
              entradaId: entrada.id,
              entregadaPorId: enc.id,
            },
          });
        }
      }
    }
    escenarios.push({ cli, target });
  }

  for (let i = 0; i < finalizados.length && i < 12; i++) {
    const ev = finalizados[i];
    const cli = clientes[60 + i];
    const cat = ev.cats[0];
    const fecha = ev.fechas[0];
    const compra = await prisma.compraEntrada.create({
      data: {
        usuarioId: cli.id,
        eventoId: ev.evt.id,
        estado: 'APROBADA',
        montoTotal: cat.precio,
        reembolsoHasta: new Date('2026-09-01'),
        items: { create: { categoriaId: cat.id, fechaId: fecha.id, cantidad: 1, precioUnit: cat.precio } },
      },
    });
    const ticket = await tomarTicket(cat.id);
    const codigo = ticket?.codigo || newTicketCode();
    const entrada = await prisma.entrada.create({
      data: {
        compraId: compra.id,
        eventoId: ev.evt.id,
        categoriaId: cat.id,
        fechaId: fecha.id,
        titularId: cli.id,
        ticketPoolId: ticket?.id ?? null,
        codigoQr: codigo,
        codigo,
        estado: 'ASIGNADA',
      },
    });
    await prisma.reembolsoEntrada.create({
      data: {
        entradaId: entrada.id,
        usuarioId: cli.id,
        motivo: 'Plazo de devolución vencido',
        estado: 'RECHAZADO',
        monto: cat.precio,
      },
    });
  }

  const granConsumidor = clientes[0];
  const evPOS = publicados[0] || eventos[0];
  const neg = negocios[0];
  let saldo = await prisma.saldoEvento.create({
    data: { usuarioId: granConsumidor.id, eventoId: evPOS.evt.id, saldo: 250 },
  });

  const rec = staff.recargadores[0];
  await prisma.transaccionSaldo.create({
    data: {
      saldoEventoId: saldo.id,
      usuarioId: granConsumidor.id,
      eventoId: evPOS.evt.id,
      operadorId: rec.id,
      tipo: 'RECARGA',
      monto: 250,
      saldoResultante: 250,
      estado: 'COMPLETADA',
      nota: 'Recarga inicial alta',
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
        negocioId: neg.neg.id,
        eventoId: evPOS.evt.id,
        ayudanteId: neg.ayudantes[0].u.id,
        clienteId: granConsumidor.id,
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
        usuarioId: granConsumidor.id,
        eventoId: evPOS.evt.id,
        operadorId: rec.id,
        tipo: 'COMPRA_PRODUCTO',
        monto: sub,
        saldoResultante: saldo.saldo,
        ventaId: venta.id,
        estado: 'COMPLETADA',
      },
    });
  }

  const txInc = await prisma.transaccionSaldo.create({
    data: {
      saldoEventoId: saldo.id,
      usuarioId: granConsumidor.id,
      eventoId: evPOS.evt.id,
      operadorId: rec.id,
      tipo: 'RECARGA',
      monto: 40,
      saldoResultante: Number(saldo.saldo) + 40,
      estado: 'ERROR',
      nota: 'Doble escaneo reportado',
    },
  });
  await prisma.saldoEvento.update({
    where: { id: saldo.id },
    data: { saldo: Number(saldo.saldo) + 40 },
  });
  await prisma.incidenciaRecarga.create({
    data: {
      transaccionId: txInc.id,
      eventoId: evPOS.evt.id,
      recargadorId: rec.id,
      tipo: 'RECARGA_DUPLICADA',
      descripcion: 'Cliente indica doble débito en QR de recarga',
      estado: 'ABIERTA',
    },
  });

  const sinSaldo = clientes[1];
  await prisma.saldoEvento.create({
    data: { usuarioId: sinSaldo.id, eventoId: evPOS.evt.id, saldo: 0 },
  });

  for (let s = 2; s < 15; s++) {
    const ev = publicados[s % publicados.length];
    if (!ev) continue;
    const saldoRow = await prisma.saldoEvento.create({
      data: {
        usuarioId: clientes[s].id,
        eventoId: ev.evt.id,
        saldo: 20 + s * 3,
      },
    });
    await prisma.transaccionSaldo.create({
      data: {
        saldoEventoId: saldoRow.id,
        usuarioId: clientes[s].id,
        eventoId: ev.evt.id,
        operadorId: staff.recargadores[s % staff.recargadores.length].id,
        tipo: 'RECARGA',
        monto: saldoRow.saldo,
        saldoResultante: saldoRow.saldo,
        estado: 'COMPLETADA',
      },
    });
  }

  // Devolución de saldo vigente (<30 días) vs saldo sin retirar en evento viejo
  if (finalizados[0] && clientes[70]) {
    const evReciente = finalizados[finalizados.length - 1] || finalizados[0];
    const saldoDev = await prisma.saldoEvento.create({
      data: { usuarioId: clientes[70].id, eventoId: evReciente.evt.id, saldo: 85 },
    });
    await prisma.transaccionSaldo.create({
      data: {
        saldoEventoId: saldoDev.id,
        usuarioId: clientes[70].id,
        eventoId: evReciente.evt.id,
        operadorId: staff.devoluciones[0].id,
        tipo: 'RECARGA',
        monto: 85,
        saldoResultante: 85,
        estado: 'COMPLETADA',
      },
    });
    await prisma.transaccionSaldo.create({
      data: {
        saldoEventoId: saldoDev.id,
        usuarioId: clientes[70].id,
        eventoId: evReciente.evt.id,
        operadorId: staff.devoluciones[0].id,
        tipo: 'DEVOLUCION',
        monto: 40,
        saldoResultante: 45,
        estado: 'COMPLETADA',
        nota: 'Devolución parcial de saldo no consumido',
      },
    });
    await prisma.saldoEvento.update({ where: { id: saldoDev.id }, data: { saldo: 45 } });
  }
  if (finalizados[0] && clientes[71]) {
    const evViejo = finalizados[0];
    await prisma.saldoEvento.create({
      data: { usuarioId: clientes[71].id, eventoId: evViejo.evt.id, saldo: 120 },
    });
  }
}

async function crearInvitaciones(admin) {
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
        telefono: phoneFor(8500 + i),
        role: inv.role,
        tokenHash: createHash('sha256').update(randomBytes(16)).digest('hex'),
        expiresAt: dateOnly('2027-02-28'),
        estado: 'PENDIENTE',
        creadoPorId: admin.id,
      },
    });
  }
}

async function resumen() {
  const counts = {
    usuarios: await prisma.usuario.count(),
    eventos: await prisma.evento.count(),
    solicitudesEvento: await prisma.solicitudEvento.count(),
    fechas: await prisma.fechaEvento.count(),
    categorias: await prisma.categoriaEntrada.count(),
    ticketPool: await prisma.ticketPool.count(),
    compras: await prisma.compraEntrada.count(),
    entradas: await prisma.entrada.count(),
    accesos: await prisma.accesoEvento.count(),
    negocios: await prisma.negocio.count(),
    ayudantes: await prisma.ayudanteNegocio.count(),
    ventas: await prisma.venta.count(),
    reembolsos: await prisma.reembolsoEntrada.count(),
    manillas: await prisma.manilla.count(),
    saldos: await prisma.saldoEvento.count(),
    incidenciasRecarga: await prisma.incidenciaRecarga.count(),
    solicitudesNegocio: await prisma.solicitudNegocio.count(),
    invitaciones: await prisma.invitacionUsuario.count(),
  };
  return counts;
}

function escribirCredenciales() {
  const lines = ['# Credenciales EvenTix – Cochabamba', ''];
  for (const [rol, items] of Object.entries(loginPorRol)) {
    lines.push(`## ${rol}`);
    lines.push(`Contraseña del rol: ${PASSWORDS[rol]}`);
    for (const it of items) {
      lines.push(`- ${it.email}`);
    }
    lines.push('');
  }
  const file = path.join(__dirname, 'CREDENCIALES.local.md');
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  const jsonFile = path.join(__dirname, 'credenciales.local.json');
  fs.writeFileSync(jsonFile, JSON.stringify({ passwords: PASSWORDS, logins: loginPorRol }, null, 2));
  return file;
}

async function main() {
  console.log('EvenTix seed-show: wipe + población completa…');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no definida en backend/.env');
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Faltan variables CLOUDINARY_*');
  initCloudinary();

  await wipeAll(prisma);
  console.log('Wipe completado.');

  console.log('Creando usuarios…');
  const users = await crearUsuarios();
  console.log(`Usuarios: ${Object.values(users).reduce((n, a) => n + a.length, 0)}`);
  const staffPools = {
    encargados: users.ENCARGADO_ACCESO,
    recargadores: users.RECARGADOR,
    devoluciones: users.DEVOLUCIONES,
  };

  console.log('Creando eventos (45)…');
  const { eventos } = await crearEventos(users.ORGANIZADOR, staffPools, initCloudinary());
  const publicados = eventos.filter((e) => ['PUBLICADO', 'FINALIZADO'].includes(e.plan.estado));
  console.log(`Eventos listos. Publicados/finalizados: ${publicados.length}`);

  console.log('Creando negocios…');
  const negocios = await crearNegocios(users.JEFE_NEGOCIO, publicados, users.ADMIN[0]);
  console.log(`Negocios: ${negocios.length}`);
  console.log('Compras, accesos, saldos y ventas…');
  await crearComprasYOperaciones(users.CLIENTE, eventos, negocios, staffPools);
  await crearInvitaciones(users.ADMIN[0]);

  const counts = await resumen();
  const credPath = escribirCredenciales();

  console.log('\n=== Resumen de conteos ===');
  for (const [k, v] of Object.entries(counts)) console.log(`${k}: ${v}`);

  console.log('\n=== Logins por rol (muestra) ===');
  for (const [rol, items] of Object.entries(loginPorRol)) {
    console.log(`\n${rol} (password: ${PASSWORDS[rol]})`);
    for (const it of items) console.log(`  ${it.email}`);
  }

  console.log(`\nCredenciales → ${credPath}`);
  console.log('Población finalizada.');
}

main()
  .catch((e) => {
    console.error('Seed-show falló:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });