import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Money = Prisma.Decimal | number | string | null | undefined;

/** Montos como texto con 2 decimales, igual que el resto de la API. */
export function money(value: Money) {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

export function nombreCompleto(
  u?: { nombre: string; apellido: string | null } | null,
) {
  if (!u) return null;
  return [u.nombre, u.apellido].filter(Boolean).join(' ');
}

/** Código corto para mostrar al cliente, p. ej. "TX-9F3A2C1B". */
export function codigoTransaccion(id: string) {
  return `TX-${id.slice(-8).toUpperCase()}`;
}

/**
 * Id con el mismo aspecto que un cuid. Se genera aquí para insertar con `createMany`, que en
 * MySQL no vuelve a leer la fila creada (cada lectura extra es un viaje más a la base remota).
 */
export function newId() {
  return `c${Date.now().toString(36)}${randomBytes(9).toString('hex')}`;
}

/**
 * Columnas de una venta sin relaciones anidadas: Prisma resuelve cada relación con una consulta
 * aparte, así que los nombres se buscan en paralelo con `nombresDeVentas`.
 */
export const VENTA_ROW_SELECT = {
  id: true,
  total: true,
  createdAt: true,
  clienteId: true,
  ayudanteId: true,
  eventoId: true,
  negocioId: true,
  detalles: { select: { cantidad: true, productoId: true } },
} satisfies Prisma.VentaSelect;

export type VentaRow = Prisma.VentaGetPayload<{
  select: typeof VENTA_ROW_SELECT;
}>;

const unique = (ids: (string | null)[]) => [
  ...new Set(ids.filter((id): id is string => Boolean(id))),
];

/** Nombres de clientes, ayudantes, eventos, negocios y productos de un conjunto de ventas. */
export async function nombresDeVentas(
  prisma: PrismaService,
  ventas: VentaRow[],
) {
  const usuarioIds = unique(ventas.flatMap((v) => [v.clienteId, v.ayudanteId]));
  const eventoIds = unique(ventas.map((v) => v.eventoId));
  const negocioIds = unique(ventas.map((v) => v.negocioId));
  const productoIds = unique(
    ventas.flatMap((v) => v.detalles.map((d) => d.productoId)),
  );

  const [usuarios, eventos, negocios, productos] = await Promise.all([
    usuarioIds.length
      ? prisma.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, nombre: true, apellido: true },
        })
      : [],
    eventoIds.length
      ? prisma.evento.findMany({
          where: { id: { in: eventoIds } },
          select: { id: true, titulo: true },
        })
      : [],
    negocioIds.length
      ? prisma.negocio.findMany({
          where: { id: { in: negocioIds } },
          select: { id: true, nombre: true },
        })
      : [],
    productoIds.length
      ? prisma.producto.findMany({
          where: { id: { in: productoIds } },
          select: { id: true, nombre: true },
        })
      : [],
  ]);

  const usuario = new Map(usuarios.map((u) => [u.id, nombreCompleto(u) ?? '']));
  const evento = new Map(eventos.map((e) => [e.id, e.titulo]));
  const negocio = new Map(negocios.map((n) => [n.id, n.nombre]));
  const producto = new Map(productos.map((p) => [p.id, p.nombre]));

  return {
    cliente: (v: VentaRow) =>
      (v.clienteId && usuario.get(v.clienteId)) || 'Cliente',
    ayudante: (v: VentaRow) => usuario.get(v.ayudanteId) ?? '',
    evento: (v: VentaRow) => evento.get(v.eventoId) ?? 'Evento',
    negocio: (v: VentaRow) => negocio.get(v.negocioId) ?? 'Negocio',
    /** "1x Hamburguesa, 2x Gaseosa" */
    productos: (v: VentaRow) =>
      v.detalles
        .map(
          (d) => `${d.cantidad}x ${producto.get(d.productoId) ?? 'Producto'}`,
        )
        .join(', '),
  };
}
