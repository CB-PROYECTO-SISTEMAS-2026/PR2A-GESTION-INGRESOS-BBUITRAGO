/* eslint-disable no-console */
const path = require('path');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PASSWORDS } = require('./catalog');

const prisma = new PrismaClient();
const OUT =
  process.env.CUENTAS_XLSX ||
  'D:\\Proyecto_Sistemas_II\\EvenTix_Cuentas_Prueba.xlsx';

function casoPara(roles, meta) {
  const r = roles[0];
  if (r === 'ADMIN') {
    return 'Aprobar/rechazar solicitudes de evento y negocio; revisar compras; liquidaciones; retiros; incidencias de recarga; usuarios e invitaciones.';
  }
  if (r === 'ORGANIZADOR') {
    return meta.eventosOrg
      ? `Organizador con ${meta.eventosOrg} evento(s): ${meta.titulosOrg || '—'}. Crear/editar eventos, reportes e incidencias.`
      : 'Organizador sin eventos propios aún (revisar invitaciones/solicitudes).';
  }
  if (r === 'JEFE_NEGOCIO') {
    return meta.negocio
      ? `Dueño de «${meta.negocio}». Productos, ayudantes, solicitudes a eventos, ventas y retiros de ganancias.`
      : 'Jefe sin negocio asociado.';
  }
  if (r === 'AYUDANTE') {
    return meta.negocioAy
      ? `Cajero POS en «${meta.negocioAy}» (${meta.estadoAy || '—'}). Cobrar con saldo/manilla/QR según evento.`
      : 'Ayudante sin asignación de negocio.';
  }
  if (r === 'ENCARGADO_ACCESO') {
    return 'Control de acceso (ingreso/salida/rechazo) y entrega de manillas en puntos de retiro asignados.';
  }
  if (r === 'RECARGADOR') {
    return 'Terminal de recargas de saldo en eventos asignados (StaffEvento RECARGADOR). Reportar incidencias de recarga.';
  }
  if (r === 'DEVOLUCIONES') {
    return 'Terminal de devolución de saldo post-evento (plazo 30 días). Verificar foto de ingreso.';
  }
  if (r === 'CLIENTE') {
    const partes = [];
    if (meta.compras) partes.push(`${meta.compras} compra(s)`);
    if (meta.entradas) partes.push(`${meta.entradas} entrada(s)`);
    if (meta.accesos) partes.push(`${meta.accesos} acceso(s)`);
    if (meta.saldos) partes.push(`saldo en ${meta.saldos} evento(s), total Bs ${meta.saldoTotal}`);
    if (meta.reembolsos) partes.push(`${meta.reembolsos} reembolso(s)`);
    if (meta.flags?.length) partes.push(meta.flags.join('; '));
    return partes.length
      ? `Cliente: ${partes.join(' · ')}`
      : 'Cliente sin actividad operativa cargada.';
  }
  return roles.join(', ');
}

async function main() {
  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ createdAt: 'asc' }],
    include: {
      roles: true,
      negocio: { select: { id: true, nombre: true } },
      ayudanteDe: {
        include: { negocio: { select: { nombre: true } } },
      },
      eventosOrganizados: { select: { id: true, titulo: true, estado: true } },
      compras: { select: { id: true, estado: true, eventoId: true } },
      entradas: { select: { id: true, estado: true, eventoId: true } },
      saldosEvento: { select: { saldo: true, eventoId: true } },
      reembolsos: { select: { id: true, estado: true } },
      staffAsignaciones: {
        where: { activo: true },
        select: { role: true, evento: { select: { titulo: true, estado: true } } },
      },
    },
  });

  const entradaTitular = Object.fromEntries(
    (
      await prisma.entrada.findMany({
        where: { titularId: { not: null } },
        select: { id: true, titularId: true },
      })
    ).map((e) => [e.id, e.titularId]),
  );
  const accesosCount = {};
  for (const a of await prisma.accesoEvento.findMany({
    select: { entradaId: true, tipo: true },
  })) {
    const tid = entradaTitular[a.entradaId];
    if (!tid) continue;
    accesosCount[tid] = (accesosCount[tid] || 0) + 1;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'EvenTix';
  wb.created = new Date();

  const ws = wb.addWorksheet('Cuentas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = [
    { header: '#', key: 'n', width: 5 },
    { header: 'Nombre', key: 'nombre', width: 22 },
    { header: 'Apellido', key: 'apellido', width: 18 },
    { header: 'Rol', key: 'rol', width: 20 },
    { header: 'Email', key: 'email', width: 42 },
    { header: 'Contraseña', key: 'password', width: 22 },
    { header: 'Teléfono', key: 'telefono', width: 16 },
    { header: 'Documento', key: 'documento', width: 14 },
    { header: 'Activo', key: 'activo', width: 8 },
    { header: 'Caso para probar', key: 'caso', width: 70 },
    { header: 'Detalle operativo', key: 'detalle', width: 55 },
    { header: 'Eventos / negocio / staff', key: 'contexto', width: 45 },
  ];

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E79' },
  };
  header.alignment = { vertical: 'middle', wrapText: true };

  let n = 0;
  const porRol = {};

  for (const u of usuarios) {
    const roles = u.roles.map((x) => x.role);
    // Una fila por rol si tiene varios (raro); si no, una fila
    const lista = roles.length ? roles : ['(sin rol)'];
    for (const rol of lista) {
      n++;
      const pw = PASSWORDS[rol] || '(no definida para este rol)';
      const flags = [];
      const saldoTotal = u.saldosEvento.reduce((s, x) => s + Number(x.saldo), 0);
      if (rol === 'CLIENTE') {
        if (u.saldosEvento.some((s) => Number(s.saldo) >= 150))
          flags.push('saldo alto');
        if (u.saldosEvento.some((s) => Number(s.saldo) === 0))
          flags.push('saldo en 0');
        if (!u.saldosEvento.length) flags.push('sin fila SaldoEvento');
        if (u.reembolsos.some((r) => r.estado === 'SOLICITADO'))
          flags.push('reembolso SOLICITADO');
        if (u.reembolsos.some((r) => r.estado === 'PAGADO'))
          flags.push('reembolso PAGADO');
        if (u.reembolsos.some((r) => r.estado === 'RECHAZADO'))
          flags.push('reembolso RECHAZADO');
        if (u.compras.some((c) => c.estado === 'PENDIENTE'))
          flags.push('compra PENDIENTE');
        if (u.compras.some((c) => c.estado === 'RECHAZADA'))
          flags.push('compra RECHAZADA');
        if ((accesosCount[u.id] || 0) > 0) flags.push('tiene ingresos/salidas');
      }

      const meta = {
        eventosOrg: u.eventosOrganizados.length,
        titulosOrg: u.eventosOrganizados
          .slice(0, 3)
          .map((e) => `${e.titulo} (${e.estado})`)
          .join(', '),
        negocio: u.negocio?.nombre,
        negocioAy: u.ayudanteDe?.negocio?.nombre,
        estadoAy: u.ayudanteDe?.estado,
        compras: u.compras.length,
        entradas: u.entradas.length,
        accesos: accesosCount[u.id] || 0,
        saldos: u.saldosEvento.length,
        saldoTotal: saldoTotal.toFixed(2),
        reembolsos: u.reembolsos.length,
        flags,
      };

      const staffTxt = u.staffAsignaciones
        .slice(0, 4)
        .map((s) => `${s.role}@${s.evento.titulo}`)
        .join('; ');

      const contexto = [
        u.negocio ? `Negocio: ${u.negocio.nombre}` : null,
        u.ayudanteDe ? `Ayudante en: ${u.ayudanteDe.negocio?.nombre}` : null,
        meta.titulosOrg ? `Eventos: ${meta.titulosOrg}` : null,
        staffTxt ? `Staff: ${staffTxt}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const detalle = [
        `Compras: ${u.compras.length}`,
        `Entradas: ${u.entradas.length}`,
        `Accesos: ${accesosCount[u.id] || 0}`,
        `Saldos: ${u.saldosEvento.length} (Bs ${saldoTotal.toFixed(2)})`,
        `Reembolsos: ${u.reembolsos.length}`,
        `Staff activos: ${u.staffAsignaciones.length}`,
      ].join(' · ');

      const row = ws.addRow({
        n,
        nombre: u.nombre,
        apellido: u.apellido || '',
        rol,
        email: u.email,
        password: pw,
        telefono: u.telefono || '',
        documento: u.documento || '',
        activo: u.activo ? 'Sí' : 'No',
        caso: casoPara([rol], meta),
        detalle,
        contexto,
      });
      row.alignment = { vertical: 'top', wrapText: true };

      if (!porRol[rol]) porRol[rol] = [];
      porRol[rol].push({
        email: u.email,
        password: pw,
        nombre: `${u.nombre} ${u.apellido || ''}`.trim(),
        caso: casoPara([rol], meta),
      });
    }
  }

  // ——— Hoja Eventos (toda la info) ———
  const evs = await prisma.evento.findMany({
    orderBy: [{ createdAt: 'asc' }],
    include: {
      organizador: { select: { nombre: true, apellido: true, email: true } },
      solicitud: {
        select: {
          id: true,
          estado: true,
          empresa: true,
          mapaUrl: true,
          mapaNombre: true,
          reembolsoHoras: true,
        },
      },
      fechas: { orderBy: { fecha: 'asc' } },
      categorias: {
        include: {
          fechasDisponibles: true,
          _count: { select: { ticketsPool: true, entradas: true } },
        },
      },
      staff: {
        where: { activo: true },
        include: { usuario: { select: { email: true, nombre: true, apellido: true } } },
      },
      puntosRetiro: {
        include: {
          supervisores: {
            where: { activo: true },
            include: { usuario: { select: { email: true } } },
          },
        },
      },
      liquidacion: true,
      mapHistory: { orderBy: { createdAt: 'asc' } },
      solicitudesNegocio: {
        include: { negocio: { select: { nombre: true } } },
      },
      _count: {
        select: {
          compras: true,
          entradas: true,
          ventas: true,
          manillas: true,
          saldos: true,
          accesos: true,
          accesosRechazados: true,
          transacciones: true,
          incidenciasRecarga: true,
          incidenciasOrganizador: true,
        },
      },
    },
  });

  const we = wb.addWorksheet('Eventos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  we.columns = [
    { header: '#', key: 'n', width: 5 },
    { header: 'ID evento', key: 'id', width: 28 },
    { header: 'Título', key: 'titulo', width: 36 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Tipo acceso', key: 'tipoAcceso', width: 12 },
    { header: 'Fecha inicio', key: 'fechaInicio', width: 12 },
    { header: 'Fecha fin', key: 'fechaFin', width: 12 },
    { header: 'Días (#)', key: 'numDias', width: 8 },
    { header: 'Fechas (lista)', key: 'fechasLista', width: 40 },
    { header: 'Hora inicio', key: 'horaInicio', width: 10 },
    { header: 'Hora fin', key: 'horaFin', width: 10 },
    { header: 'Ubicación', key: 'ubicacion', width: 40 },
    { header: 'URL ubicación (maps)', key: 'ubicacionUrl', width: 40 },
    { header: 'Capacidad', key: 'capacidad', width: 10 },
    { header: 'Reembolso horas', key: 'reembolsoHoras', width: 12 },
    { header: 'Organizador', key: 'organizador', width: 24 },
    { header: 'Email organizador', key: 'orgEmail', width: 36 },
    { header: 'Descripción', key: 'descripcion', width: 50 },
    { header: 'Servicios (JSON)', key: 'servicios', width: 35 },
    { header: 'Cronograma (JSON)', key: 'cronograma', width: 40 },
    { header: 'Flyer / foto URL', key: 'fotoUrl', width: 45 },
    { header: 'Flyer Cloudinary publicId', key: 'fotoPublicId', width: 36 },
    { header: 'Mapa URL', key: 'mapaUrl', width: 45 },
    { header: 'QR pago URL', key: 'qrPagoUrl', width: 45 },
    { header: 'QR pago publicId', key: 'qrPagoPublicId', width: 36 },
    { header: 'Instrucciones pago', key: 'instruccionesPago', width: 35 },
    { header: 'Punto retiro manilla', key: 'puntoRetiroManilla', width: 28 },
    { header: 'Horario retiro manilla', key: 'horarioRetiroManilla', width: 18 },
    { header: 'Puntos retiro (detalle)', key: 'puntosDetalle', width: 45 },
    { header: 'Categorías / precios / cupos', key: 'categorias', width: 55 },
    { header: 'Pool tickets (total)', key: 'poolTotal', width: 12 },
    { header: 'Staff asignado', key: 'staff', width: 50 },
    { header: 'Negocios (solicitudes)', key: 'negocios', width: 45 },
    { header: 'Historial mapas', key: 'mapHistory', width: 45 },
    { header: 'Solicitud ID', key: 'solicitudId', width: 28 },
    { header: 'Solicitud estado', key: 'solicitudEstado', width: 14 },
    { header: 'Empresa solicitud', key: 'empresa', width: 22 },
    { header: 'Mapa solicitud URL', key: 'mapaSolicitud', width: 40 },
    { header: 'Liquidación estado', key: 'liqEstado', width: 14 },
    { header: 'Liquidación monto', key: 'liqMonto', width: 14 },
    { header: '# Compras', key: 'nCompras', width: 10 },
    { header: '# Entradas', key: 'nEntradas', width: 10 },
    { header: '# Ventas', key: 'nVentas', width: 10 },
    { header: '# Manillas', key: 'nManillas', width: 10 },
    { header: '# Saldos', key: 'nSaldos', width: 10 },
    { header: '# Accesos', key: 'nAccesos', width: 10 },
    { header: '# Rechazos acceso', key: 'nRechazos', width: 12 },
    { header: '# Transacciones saldo', key: 'nTx', width: 12 },
    { header: '# Incid. recarga', key: 'nIncRec', width: 12 },
    { header: '# Incid. organizador', key: 'nIncOrg', width: 12 },
    { header: 'Creado', key: 'createdAt', width: 20 },
    { header: 'Actualizado', key: 'updatedAt', width: 20 },
  ];
  const eh = we.getRow(1);
  eh.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  eh.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC65911' },
  };
  eh.alignment = { vertical: 'middle', wrapText: true };

  let ne = 0;
  for (const e of evs) {
    ne++;
    const fechasIso = e.fechas.map((f) =>
      new Date(f.fecha).toISOString().slice(0, 10),
    );
    const catsTxt = e.categorias
      .map((c) => {
        const precio = Number(c.precio).toFixed(2);
        return `${c.nombre}: Bs ${precio} | cupo ${c.cupo} | desc ${c.descuento}% | pool ${c._count.ticketsPool} | vendidas ${c._count.entradas}`;
      })
      .join('\n');
    const poolTotal = e.categorias.reduce(
      (s, c) => s + c._count.ticketsPool,
      0,
    );
    const staffTxt = e.staff
      .map(
        (s) =>
          `${s.role}: ${s.usuario.nombre} ${s.usuario.apellido || ''} <${s.usuario.email}>`,
      )
      .join('\n');
    const puntosTxt = e.puntosRetiro
      .map((p) => {
        const supers = p.supervisores.map((s) => s.usuario.email).join(', ');
        return `${p.nombre} | ${p.ubicacion || '—'} | ${p.horario || '—'} | activo=${p.activo} | supervisores: ${supers || '—'}`;
      })
      .join('\n');
    const negociosTxt = e.solicitudesNegocio
      .map((s) => `${s.negocio.nombre} (${s.estado})`)
      .join('; ');
    const mapHistTxt = e.mapHistory
      .map(
        (m) =>
          `${m.tipo} ${m.createdAt.toISOString().slice(0, 10)} | ${m.mapaNombre || '—'} | ${m.mapaUrl}`,
      )
      .join('\n');
    const horaIni = e.fechas[0]?.horaInicio || '';
    const horaFin = e.fechas[0]?.horaFin || '';

    const row = we.addRow({
      n: ne,
      id: e.id,
      titulo: e.titulo,
      estado: e.estado,
      tipoAcceso: e.tipoAcceso,
      fechaInicio: fechasIso[0] || '',
      fechaFin: fechasIso[fechasIso.length - 1] || '',
      numDias: fechasIso.length,
      fechasLista: fechasIso.join(', '),
      horaInicio: horaIni,
      horaFin: horaFin,
      ubicacion: e.ubicacion,
      ubicacionUrl: e.ubicacionUrl || '',
      capacidad: e.capacidad ?? '',
      reembolsoHoras: e.reembolsoHoras,
      organizador: `${e.organizador.nombre} ${e.organizador.apellido || ''}`.trim(),
      orgEmail: e.organizador.email,
      descripcion: e.descripcion,
      servicios: e.servicios ? JSON.stringify(e.servicios) : '',
      cronograma: e.cronograma ? JSON.stringify(e.cronograma) : '',
      fotoUrl: e.fotoUrl || '',
      fotoPublicId: e.fotoPublicId || '',
      mapaUrl: e.mapaUrl || '',
      qrPagoUrl: e.qrPagoUrl || '',
      qrPagoPublicId: e.qrPagoPublicId || '',
      instruccionesPago: e.instruccionesPago || '',
      puntoRetiroManilla: e.puntoRetiroManilla || '',
      horarioRetiroManilla: e.horarioRetiroManilla || '',
      puntosDetalle: puntosTxt,
      categorias: catsTxt,
      poolTotal,
      staff: staffTxt,
      negocios: negociosTxt,
      mapHistory: mapHistTxt,
      solicitudId: e.solicitudId || '',
      solicitudEstado: e.solicitud?.estado || '',
      empresa: e.solicitud?.empresa || '',
      mapaSolicitud: e.solicitud?.mapaUrl || '',
      liqEstado: e.liquidacion?.estado || '',
      liqMonto: e.liquidacion ? Number(e.liquidacion.montoTotal).toFixed(2) : '',
      nCompras: e._count.compras,
      nEntradas: e._count.entradas,
      nVentas: e._count.ventas,
      nManillas: e._count.manillas,
      nSaldos: e._count.saldos,
      nAccesos: e._count.accesos,
      nRechazos: e._count.accesosRechazados,
      nTx: e._count.transacciones,
      nIncRec: e._count.incidenciasRecarga,
      nIncOrg: e._count.incidenciasOrganizador,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    });
    row.alignment = { vertical: 'top', wrapText: true };

    // Hipervínculos a imágenes
    for (const col of ['fotoUrl', 'mapaUrl', 'qrPagoUrl', 'ubicacionUrl', 'mapaSolicitud']) {
      const cell = row.getCell(col);
      const url = String(cell.value || '');
      if (url.startsWith('http')) {
        cell.value = { text: url, hyperlink: url };
        cell.font = { color: { argb: 'FF0563C1' }, underline: true };
      }
    }
  }

  // Hoja resumen por rol
  const rs = wb.addWorksheet('Resumen por rol');
  rs.columns = [
    { header: 'Rol', key: 'rol', width: 20 },
    { header: 'Cantidad', key: 'cant', width: 10 },
    { header: 'Contraseña del rol', key: 'pw', width: 22 },
    { header: 'Email ejemplo 1', key: 'e1', width: 42 },
    { header: 'Email ejemplo 2', key: 'e2', width: 42 },
    { header: 'Email ejemplo 3', key: 'e3', width: 42 },
  ];
  rs.getRow(1).font = { bold: true };
  for (const [rol, items] of Object.entries(porRol)) {
    rs.addRow({
      rol,
      cant: items.length,
      pw: PASSWORDS[rol] || '',
      e1: items[0]?.email || '',
      e2: items[1]?.email || '',
      e3: items[2]?.email || '',
    });
  }

  // Hoja casos destacados clientes
  const cs = wb.addWorksheet('Casos cliente destacados');
  cs.columns = [
    { header: 'Email', key: 'email', width: 42 },
    { header: 'Contraseña', key: 'password', width: 16 },
    { header: 'Caso', key: 'caso', width: 80 },
  ];
  cs.getRow(1).font = { bold: true };
  for (const item of porRol.CLIENTE || []) {
    if (
      item.caso.includes('saldo') ||
      item.caso.includes('reembolso') ||
      item.caso.includes('compra') ||
      item.caso.includes('ingreso')
    ) {
      cs.addRow({
        email: item.email,
        password: item.password,
        caso: item.caso,
      });
    }
  }

  // Contraseñas
  const ps = wb.addWorksheet('Contraseñas por rol');
  ps.columns = [
    { header: 'Rol', key: 'rol', width: 22 },
    { header: 'Contraseña', key: 'pw', width: 24 },
  ];
  ps.getRow(1).font = { bold: true };
  for (const [rol, pw] of Object.entries(PASSWORDS)) {
    ps.addRow({ rol, pw });
  }

  await wb.xlsx.writeFile(OUT);
  console.log(`Excel generado: ${OUT}`);
  console.log(`Filas de cuentas: ${n}`);
  console.log(`Filas de eventos: ${ne}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
