/**
 * Crea en la base compartida el escenario que usan las pruebas de integración del POS (Módulo E)
 * y de recargas (Módulo D).
 *
 * Todo lo creado lleva la marca "[PRUEBA-AUTO]" (eventos, negocios) o un correo
 * "@pruebas.eventix.test" (usuarios), para que helpers/limpieza.js pueda encontrarlo y borrarlo
 * sin tocar datos reales. NUNCA uses aquí usuarios, negocios o eventos existentes.
 */
import { randomBytes } from 'crypto';
import {
  AyudanteNegocio_estado,
  EntradaEstado,
  EventoEstado,
  Prisma,
  Role,
  SolicitudNegocio_estado,
} from '@prisma/client';
import { PrismaService } from '../../../backend/src/prisma/prisma.service';
import { minuteOfDayIn } from '../../../backend/src/modules/pos/pos-dates';
import { todayIn } from '../../../backend/src/modules/events/event-schedule';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MARCA, DOMINIO } = require('./limpieza') as { MARCA: string; DOMINIO: string };

const TZ = process.env.APP_TIMEZONE || 'America/La_Paz';
export const SALDO_INICIAL = 100;

export interface Escenario {
  /** Sufijo aleatorio de esta ejecución (evita choques con datos de otra ejecución). */
  sufijo: string;
  usuarios: {
    cliente: string;
    ayudante: string;
    /** Otro ayudante del mismo negocio (para probar claves de cobro ajenas). */
    ayudante2: string;
    jefe: string;
    jefeOtroNegocio: string;
    organizador: string;
    /** Otro organizador (no es dueño de los eventos del escenario). */
    organizador2: string;
    /** Recargador asignado a los eventos "abierto" y "cerrado" (Módulo D). */
    recargador: string;
    /** Recargador sin ningún evento asignado. */
    recargador2: string;
    /** Administrador general (anula recargas). */
    admin: string;
    /** Cliente con entrada en el evento abierto pero todavía SIN saldo (sin fila SaldoEvento). */
    cliente2: string;
  };
  negocioId: string;
  otroNegocioId: string;
  productos: {
    /** Bs 10, sin control de stock. */
    empanada: string;
    /** Bs 6, sin control de stock. */
    refresco: string;
    /** Bs 8, con stock (lo fija cada prueba con setStock). */
    limitado: string;
    /** Producto desactivado del negocio. */
    inactivo: string;
    /** Producto de OTRO negocio. */
    ajeno: string;
  };
  eventos: {
    /** Hoy, abierto todo el día, negocio aceptado. */
    abierto: string;
    /** Hoy, pero fuera de horario en este momento, negocio aceptado. */
    cerrado: string;
    /** Hoy, abierto, pero el negocio NO está aceptado. */
    noHabilitado: string;
  };
  codigos: {
    /** QR digital de una entrada del cliente en el evento abierto. */
    qr: string;
    /** Manilla vinculada a otra entrada del mismo cliente en el evento abierto. */
    manilla: string;
    /** Manilla del evento abierto que todavía no se vinculó a ninguna entrada. */
    manillaSinVincular: string;
    /** Entrada anulada del cliente en el evento abierto. */
    entradaAnulada: string;
    /** Entrada del cliente en el evento "cerrado" (para probar códigos de otro evento). */
    entradaOtroEvento: string;
    /** QR digital de la entrada de cliente2 en el evento abierto. */
    qrCliente2: string;
  };
  /** Horario del evento "cerrado" (lejos de la hora actual). */
  horarioCerrado: string;
}

const hhmm = (minutos: number) => {
  const m = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export async function crearUsuario(
  prisma: PrismaService,
  alias: string,
  sufijo: string,
  roles: Role[],
  nombre = `Prueba ${alias}`,
) {
  const usuario = await prisma.usuario.create({
    data: {
      email: `${alias}.${sufijo}${DOMINIO}`,
      passwordHash: 'sin-login-en-pruebas-de-integracion',
      nombre,
      apellido: 'Auto',
      roles: { create: roles.map((role) => ({ role })) },
    },
    select: { id: true },
  });
  return usuario.id;
}

async function crearNegocio(prisma: PrismaService, duenoId: string, nombre: string) {
  const negocio = await prisma.negocio.create({
    data: { duenoId, nombre: `${MARCA} ${nombre}` },
    select: { id: true },
  });
  return negocio.id;
}

async function crearAyudante(prisma: PrismaService, negocioId: string, usuarioId: string, jefeId: string, rolId: string) {
  await prisma.ayudanteNegocio.create({
    data: { negocioId, usuarioId, jefeId, rolId, estado: AyudanteNegocio_estado.ACTIVO },
  });
}

async function aceptarEnEvento(prisma: PrismaService, negocioId: string, eventoId: string) {
  await prisma.solicitudNegocio.create({
    data: { negocioId, eventoId, estado: SolicitudNegocio_estado.ACEPTADA, mensaje: MARCA },
  });
}

async function crearEvento(
  prisma: PrismaService,
  organizadorId: string,
  titulo: string,
  horaInicio: string,
  horaFin: string,
) {
  return prisma.evento.create({
    data: {
      titulo: `${MARCA} ${titulo}`,
      descripcion: 'Evento creado por las pruebas automatizadas. Se borra solo al terminar.',
      ubicacion: 'Pruebas automatizadas',
      tipoAcceso: 'AMBOS',
      estado: EventoEstado.PUBLICADO,
      organizadorId,
      fechas: {
        create: [{ fecha: new Date(`${todayIn(TZ)}T00:00:00.000Z`), horaInicio, horaFin }],
      },
      categorias: { create: [{ nombre: 'General', precio: 50, cupo: 10 }] },
    },
    select: { id: true, categorias: { select: { id: true } } },
  });
}

async function crearEntrada(
  prisma: PrismaService,
  eventoId: string,
  categoriaId: string,
  titularId: string,
  codigo: string,
  estado: EntradaEstado = EntradaEstado.ASIGNADA,
  conQrDigital = true,
) {
  return prisma.entrada.create({
    data: {
      eventoId,
      categoriaId,
      titularId,
      codigo,
      codigoQr: codigo,
      estado,
      // Como en la emisión real (HU-055): el QR digital es una credencial con el mismo código.
      ...(conQrDigital ? { credencial: { create: { codigoQr: codigo } } } : {}),
    },
    select: { id: true },
  });
}

/**
 * Sufijo aleatorio de una ejecución. Se genera ANTES de crear el escenario para que la limpieza
 * final pueda borrar lo creado aunque la creación falle a la mitad.
 */
export const nuevoSufijo = () => randomBytes(4).toString('hex');

export async function crearEscenario(prisma: PrismaService, sufijo: string): Promise<Escenario> {
  const S = sufijo.toUpperCase();

  const [
    cliente,
    ayudante,
    ayudante2,
    jefe,
    jefeOtroNegocio,
    organizador,
    organizador2,
    recargador,
    recargador2,
    admin,
    cliente2,
  ] = await Promise.all([
    crearUsuario(prisma, 'cliente', sufijo, [Role.CLIENTE]),
    crearUsuario(prisma, 'ayudante', sufijo, [Role.AYUDANTE]),
    crearUsuario(prisma, 'ayudante2', sufijo, [Role.AYUDANTE]),
    crearUsuario(prisma, 'jefe', sufijo, [Role.JEFE_NEGOCIO]),
    crearUsuario(prisma, 'jefe2', sufijo, [Role.JEFE_NEGOCIO]),
    crearUsuario(prisma, 'organizador', sufijo, [Role.ORGANIZADOR]),
    crearUsuario(prisma, 'organizador2', sufijo, [Role.ORGANIZADOR]),
    crearUsuario(prisma, 'recargador', sufijo, [Role.RECARGADOR]),
    crearUsuario(prisma, 'recargador2', sufijo, [Role.RECARGADOR]),
    crearUsuario(prisma, 'admin-saldo', sufijo, [Role.ADMIN]),
    crearUsuario(prisma, 'cliente2', sufijo, [Role.CLIENTE]),
  ]);

  const [negocioId, otroNegocioId] = await Promise.all([
    crearNegocio(prisma, jefe, `Puesto ${S}`),
    crearNegocio(prisma, jefeOtroNegocio, `Otro puesto ${S}`),
  ]);
  const { id: rolId } = await prisma.rolNegocio.create({
    data: { negocioId, nombre: 'Cajero', descripcion: MARCA },
    select: { id: true },
  });
  await Promise.all([
    crearAyudante(prisma, negocioId, ayudante, jefe, rolId),
    crearAyudante(prisma, negocioId, ayudante2, jefe, rolId),
  ]);

  const producto = (negocio: string, nombre: string, precio: number, activo = true) =>
    prisma.producto
      .create({ data: { negocioId: negocio, nombre, precio, activo }, select: { id: true } })
      .then((p) => p.id);
  const [empanada, refresco, limitado, inactivo, ajeno] = await Promise.all([
    producto(negocioId, 'Empanada', 10),
    producto(negocioId, 'Refresco', 6),
    producto(negocioId, 'Producto con stock', 8),
    producto(negocioId, 'Producto desactivado', 5, false),
    producto(otroNegocioId, 'Producto de otro negocio', 7),
  ]);

  // Evento "cerrado": hoy, con un horario que empieza 2 h después de ahora y dura 1 h. Con el
  // margen de 30 min, en este momento siempre está fuera de horario.
  const ahora = minuteOfDayIn(new Date(), TZ);
  const horarioCerrado = { inicio: hhmm(ahora + 120), fin: hhmm(ahora + 180) };
  const [abierto, cerrado, noHabilitado] = await Promise.all([
    crearEvento(prisma, organizador, `Feria abierta ${S}`, '00:00', '23:59'),
    crearEvento(prisma, organizador, `Feria fuera de horario ${S}`, horarioCerrado.inicio, horarioCerrado.fin),
    crearEvento(prisma, organizador, `Feria sin el negocio ${S}`, '00:00', '23:59'),
  ]);
  await Promise.all([
    aceptarEnEvento(prisma, negocioId, abierto.id),
    aceptarEnEvento(prisma, negocioId, cerrado.id),
  ]);

  const codigos = {
    qr: `PRUEBA-AUTO-${S}-QR`,
    manilla: `PRUEBA-AUTO-${S}-MANILLA`,
    manillaSinVincular: `PRUEBA-AUTO-${S}-MANILLA-LIBRE`,
    entradaAnulada: `PRUEBA-AUTO-${S}-ANULADA`,
    entradaOtroEvento: `PRUEBA-AUTO-${S}-OTRO-EVENTO`,
    qrCliente2: `PRUEBA-AUTO-${S}-QR-CLIENTE2`,
  };
  const categoria = abierto.categorias[0].id;
  // HU-015: una entrada con manilla vinculada ya no acepta su QR digital, así que el QR y la
  // manilla del cliente son de dos entradas distintas (el saldo es el mismo: es por evento).
  await crearEntrada(prisma, abierto.id, categoria, cliente, codigos.qr);
  const entrada = await crearEntrada(
    prisma,
    abierto.id,
    categoria,
    cliente,
    `PRUEBA-AUTO-${S}-ENTRADA-MANILLA`,
    EntradaEstado.ASIGNADA,
    false,
  );
  await Promise.all([
    crearEntrada(prisma, abierto.id, categoria, cliente, codigos.entradaAnulada, EntradaEstado.ANULADA),
    crearEntrada(prisma, cerrado.id, cerrado.categorias[0].id, cliente, codigos.entradaOtroEvento),
    prisma.manilla.create({
      data: {
        eventoId: abierto.id,
        entradaId: entrada.id,
        codigoFisico: codigos.manilla,
        vinculada: true,
        vinculadaAt: new Date(),
      },
    }),
    prisma.manilla.create({
      data: { eventoId: abierto.id, codigoFisico: codigos.manillaSinVincular, vinculada: false },
    }),
    prisma.saldoEvento.create({
      data: { usuarioId: cliente, eventoId: abierto.id, saldo: SALDO_INICIAL },
    }),
    crearEntrada(prisma, abierto.id, categoria, cliente2, codigos.qrCliente2),
    // Módulo D: el recargador trabaja en el evento abierto y en el que está fuera de horario.
    prisma.staffEvento.createMany({
      data: [
        { usuarioId: recargador, eventoId: abierto.id, role: Role.RECARGADOR },
        { usuarioId: recargador, eventoId: cerrado.id, role: Role.RECARGADOR },
      ],
    }),
  ]);

  return {
    sufijo,
    usuarios: {
      cliente,
      ayudante,
      ayudante2,
      jefe,
      jefeOtroNegocio,
      organizador,
      organizador2,
      recargador,
      recargador2,
      admin,
      cliente2,
    },
    negocioId,
    otroNegocioId,
    productos: { empanada, refresco, limitado, inactivo, ajeno },
    eventos: { abierto: abierto.id, cerrado: cerrado.id, noHabilitado: noHabilitado.id },
    codigos,
    horarioCerrado: `${horarioCerrado.inicio} – ${horarioCerrado.fin}`,
  };
}

/** Fija el saldo del cliente en el evento abierto (para que cada prueba empiece igual). */
export async function setSaldo(prisma: PrismaService, esc: Escenario, saldo: number) {
  await prisma.saldoEvento.update({
    where: {
      usuarioId_eventoId: { usuarioId: esc.usuarios.cliente, eventoId: esc.eventos.abierto },
    },
    data: { saldo },
  });
}

export async function getSaldo(prisma: PrismaService, esc: Escenario) {
  const s = await prisma.saldoEvento.findUniqueOrThrow({
    where: {
      usuarioId_eventoId: { usuarioId: esc.usuarios.cliente, eventoId: esc.eventos.abierto },
    },
    select: { saldo: true },
  });
  return s.saldo.toFixed(2);
}

/** Fija el stock de un producto (null = sin control de stock). */
export async function setStock(prisma: PrismaService, productoId: string, stock: number | null) {
  await prisma.producto.update({ where: { id: productoId }, data: { stock } });
}

export async function getStock(prisma: PrismaService, productoId: string) {
  const { stock } = await prisma.producto.findUniqueOrThrow({
    where: { id: productoId },
    select: { stock: true },
  });
  return stock;
}

/** Cambia el estado del ayudante (ACTIVO / INACTIVO) en la base compartida. */
export async function setEstadoAyudante(prisma: PrismaService, usuarioId: string, estado: 'ACTIVO' | 'INACTIVO') {
  await prisma.ayudanteNegocio.update({ where: { usuarioId }, data: { estado } });
}

export async function contarVentas(prisma: PrismaService, esc: Escenario) {
  return prisma.venta.count({ where: { eventoId: esc.eventos.abierto } });
}

/**
 * Contraseña aleatoria para los usuarios de prueba que necesitan iniciar sesión. Es distinta en
 * cada ejecución y nunca se muestra: aunque la limpieza fallara, nadie podría usar esas cuentas.
 */
export const nuevaClave = () => `${randomBytes(12).toString('base64url')}Aa1!`;

/** Asigna la contraseña a usuarios de prueba (bcrypt con costo bajo: solo para pruebas). */
export async function asignarClave(prisma: PrismaService, usuarioIds: string[], clave: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcryptjs') as { hash(s: string, rounds: number): Promise<string> };
  const passwordHash = await bcrypt.hash(clave, 4);
  await prisma.usuario.updateMany({
    where: { id: { in: usuarioIds }, email: { endsWith: DOMINIO } },
    data: { passwordHash },
  });
}

/** Día "AAAA-MM-DD" de La Paz, `dias` días atrás (0 = hoy). */
export function diaLaPaz(dias = 0) {
  const hoy = new Date(`${todayIn(TZ)}T00:00:00.000Z`);
  return new Date(hoy.getTime() - dias * 86_400_000).toISOString().slice(0, 10);
}

/** Instante UTC de una hora local de La Paz (UTC-4) en el día dado. */
export function instanteLaPaz(dia: string, hora: string) {
  return new Date(new Date(`${dia}T${hora}:00.000Z`).getTime() + 4 * 3_600_000);
}

/**
 * Crea un evento de prueba que ya ocurrió (para la liquidación) y acepta en él al negocio del
 * escenario. `estado` permite probar eventos FINALIZADO, CANCELADO o PUBLICADO ya pasados.
 */
export async function crearEventoPasado(
  prisma: PrismaService,
  esc: Escenario,
  titulo: string,
  estado: EventoEstado,
  diasAtras: number,
) {
  const evento = await prisma.evento.create({
    data: {
      titulo: `${MARCA} ${titulo} ${esc.sufijo.toUpperCase()}`,
      descripcion: 'Evento pasado creado por las pruebas automatizadas.',
      ubicacion: 'Pruebas automatizadas',
      estado,
      organizadorId: esc.usuarios.organizador,
      fechas: {
        create: [
          {
            fecha: new Date(`${diaLaPaz(diasAtras)}T00:00:00.000Z`),
            horaInicio: '10:00',
            horaFin: '20:00',
          },
        ],
      },
    },
    select: { id: true },
  });
  await aceptarEnEvento(prisma, esc.negocioId, evento.id);
  return evento.id;
}

/**
 * Registra una venta ya ocurrida directamente en la base (el POS no permite cobrar en eventos
 * pasados). Los precios se leen de los productos, como haría el cobro real.
 */
export async function registrarVenta(
  prisma: PrismaService,
  esc: Escenario,
  opciones: {
    eventoId: string;
    fecha: Date;
    items: { productoId: string; cantidad: number }[];
    clienteId?: string;
    ayudanteId?: string;
  },
) {
  const productos = await prisma.producto.findMany({
    where: { id: { in: opciones.items.map((i) => i.productoId) } },
    select: { id: true, precio: true },
  });
  const lineas = opciones.items.map((i) => {
    const precio = productos.find((p) => p.id === i.productoId)!.precio;
    return { ...i, precioUnit: precio, subtotal: precio.mul(i.cantidad) };
  });
  const total = lineas.reduce((acc, l) => acc.add(l.subtotal), new Prisma.Decimal(0));
  return prisma.venta.create({
    data: {
      negocioId: esc.negocioId,
      eventoId: opciones.eventoId,
      ayudanteId: opciones.ayudanteId ?? esc.usuarios.ayudante,
      clienteId: opciones.clienteId ?? esc.usuarios.cliente,
      total,
      createdAt: opciones.fecha,
      detalles: {
        create: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
          precioUnit: l.precioUnit,
          subtotal: l.subtotal,
        })),
      },
    },
    select: { id: true, total: true },
  });
}
