/**
 * Búsqueda y borrado de los datos que crean las pruebas automatizadas en la base compartida.
 *
 * REGLAS DE SEGURIDAD (no las relajes):
 *   - Solo se consideran datos de prueba:
 *       · eventos cuyo título empieza con MARCA ("[PRUEBA-AUTO]"),
 *       · usuarios cuyo correo termina en DOMINIO ("@pruebas.eventix.test", un dominio que no existe),
 *       · negocios cuyo dueño es uno de esos usuarios Y cuyo nombre empieza con MARCA.
 *   - Todo lo demás que se borra (ventas, saldos, entradas, retiros...) cuelga de esos registros.
 *   - El borrado ocurre dentro de una transacción: si algo falla, no se borra nada.
 *   - "[PRUEBA POS]" (el seed manual del Módulo E) NO se toca: es otra marca.
 *
 * Lo usan las pruebas de integración (al empezar y al terminar) y scripts/limpiar-datos-prueba.js.
 */
const path = require('path');

const { Prisma } = require(path.resolve(__dirname, '../../../backend/node_modules/@prisma/client'));

const MARCA = '[PRUEBA-AUTO]';
const DOMINIO = '@pruebas.eventix.test';

/**
 * Encuentra los datos de prueba y cuenta lo que se borraría. No modifica nada.
 *
 * Opciones (para no borrar los datos de otra persona que esté corriendo las pruebas a la vez):
 *   - sufijo: solo los datos de UNA ejecución (cada ejecución usa un sufijo aleatorio).
 *   - creadosAntesDe: solo datos creados antes de esa fecha (restos de ejecuciones cortadas).
 *   Sin opciones encuentra TODOS los datos de prueba (lo usa el script de limpieza manual).
 */
async function buscarDatosPrueba(prisma, { sufijo, creadosAntesDe } = {}) {
  const antes = creadosAntesDe ? { createdAt: { lt: creadosAntesDe } } : {};
  const [eventos, usuarios] = await Promise.all([
    prisma.evento.findMany({
      where: {
        titulo: { startsWith: MARCA, ...(sufijo ? { contains: sufijo } : {}) },
        ...antes,
      },
      select: { id: true, titulo: true },
    }),
    prisma.usuario.findMany({
      where: {
        email: { endsWith: DOMINIO, ...(sufijo ? { contains: `.${sufijo}@` } : {}) },
        ...antes,
      },
      select: { id: true, email: true },
    }),
  ]);
  const E = eventos.map((e) => e.id);
  const U = usuarios.map((u) => u.id);

  // SQL directo: la tabla Negocio de la base compartida es más nueva que el schema de esta rama.
  // Solo negocios cuyo dueño es un usuario de prueba Y cuyo nombre lleva la marca.
  const negocios = U.length
    ? await prisma.$queryRaw(Prisma.sql`
        SELECT id, nombre FROM Negocio
        WHERE duenoId IN (${Prisma.join(U)}) AND nombre LIKE ${`${MARCA}%`}
      `)
    : [];
  const N = negocios.map((n) => n.id);

  const filtros = filtrosDeBorrado(E, U, N);
  const [ventas, transacciones, retiros, entradas, manillas, saldos] = await Promise.all([
    prisma.venta.count({ where: filtros.ventas }),
    prisma.transaccionSaldo.count({ where: filtros.transacciones }),
    prisma.retiroGanancias.count({ where: filtros.retiros }),
    prisma.entrada.count({ where: filtros.entradas }),
    prisma.manilla.count({ where: filtros.manillas }),
    prisma.saldoEvento.count({ where: filtros.saldos }),
  ]);

  return {
    eventos,
    usuarios,
    negocios,
    conteos: { ventas, transacciones, retiros, entradas, manillas, saldos },
    vacio: !E.length && !U.length && !N.length,
  };
}

function filtrosDeBorrado(E, U, N) {
  return {
    transacciones: { OR: [{ eventoId: { in: E } }, { usuarioId: { in: U } }] },
    ventas: {
      OR: [
        { eventoId: { in: E } },
        { negocioId: { in: N } },
        { ayudanteId: { in: U } },
        { clienteId: { in: U } },
      ],
    },
    retiros: { negocioId: { in: N } },
    manillas: { eventoId: { in: E } },
    entradas: { OR: [{ eventoId: { in: E } }, { titularId: { in: U } }] },
    saldos: { OR: [{ eventoId: { in: E } }, { usuarioId: { in: U } }] },
  };
}

/**
 * Borra los datos de prueba encontrados por buscarDatosPrueba() (mismas opciones), en una sola
 * transacción.
 */
async function limpiarDatosPrueba(prisma, opciones = {}) {
  const datos = await buscarDatosPrueba(prisma, opciones);
  if (datos.vacio) return datos;

  const E = datos.eventos.map((e) => e.id);
  const U = datos.usuarios.map((u) => u.id);
  const N = datos.negocios.map((n) => n.id);
  const f = filtrosDeBorrado(E, U, N);

  await prisma.$transaction(
    async (tx) => {
      // El orden respeta las claves foráneas: primero lo que depende de otros registros.
      await tx.transaccionSaldo.deleteMany({ where: f.transacciones });
      await tx.venta.deleteMany({ where: f.ventas }); // DetalleVenta se borra en cascada
      await tx.retiroGanancias.deleteMany({ where: f.retiros });
      await tx.manilla.deleteMany({ where: f.manillas });
      await tx.entrada.deleteMany({ where: f.entradas });
      if (E.length || N.length) {
        const condiciones = [];
        if (E.length) condiciones.push(Prisma.sql`eventoId IN (${Prisma.join(E)})`);
        if (N.length) condiciones.push(Prisma.sql`negocioId IN (${Prisma.join(N)})`);
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM SolicitudNegocio WHERE ${Prisma.join(condiciones, ' OR ')}`,
        );
      }
      await tx.saldoEvento.deleteMany({ where: f.saldos });
      // Fechas, categorías y demás datos del evento se borran en cascada.
      await tx.evento.deleteMany({ where: { id: { in: E } } });
      // Productos, ayudantes y roles del negocio se borran en cascada.
      if (N.length) {
        await tx.$executeRaw(Prisma.sql`DELETE FROM Negocio WHERE id IN (${Prisma.join(N)})`);
      }
      // Los ayudantes de prueba podrían estar en un negocio sin marca (no debería pasar).
      if (U.length) {
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM AyudanteNegocio WHERE usuarioId IN (${Prisma.join(U)})`,
        );
      }
      await tx.usuario.deleteMany({ where: { id: { in: U } } }); // roles en cascada
    },
    { maxWait: 20_000, timeout: 120_000 },
  );
  return datos;
}

/** Resumen legible de lo encontrado, para el script y los mensajes de las pruebas. */
function describirDatos(datos) {
  if (datos.vacio) return 'No hay datos de prueba [PRUEBA-AUTO] en la base.';
  const c = datos.conteos;
  return [
    `Eventos [PRUEBA-AUTO]: ${datos.eventos.length}`,
    ...datos.eventos.map((e) => `   - ${e.titulo}`),
    `Usuarios ${DOMINIO}: ${datos.usuarios.length}`,
    ...datos.usuarios.map((u) => `   - ${u.email}`),
    `Negocios de prueba: ${datos.negocios.length}`,
    ...datos.negocios.map((n) => `   - ${n.nombre}`),
    `Ventas: ${c.ventas} · Transacciones de saldo: ${c.transacciones} · Retiros: ${c.retiros}`,
    `Entradas: ${c.entradas} · Manillas: ${c.manillas} · Saldos: ${c.saldos}`,
  ].join('\n');
}

module.exports = { MARCA, DOMINIO, buscarDatosPrueba, limpiarDatosPrueba, describirDatos };
