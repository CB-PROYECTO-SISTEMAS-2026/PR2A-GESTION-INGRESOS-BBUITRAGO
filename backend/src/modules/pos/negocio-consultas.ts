import {
  AyudanteNegocio_estado,
  Prisma,
  SolicitudNegocio_estado,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/*
 * Consultas de negocios que comparten el POS y el panel del negocio: asignación del ayudante,
 * eventos donde el negocio fue aceptado (SolicitudNegocio) y stock de productos.
 */

export interface AyudanteAsignacion {
  negocioId: string;
  negocioNombre: string;
  negocioActivo: boolean;
  estado: AyudanteNegocio_estado;
}

/** Negocio al que pertenece el ayudante y estado de su asignación. */
export async function findAyudanteAsignacion(
  prisma: PrismaService,
  usuarioId: string,
): Promise<AyudanteAsignacion | null> {
  const ayudante = await prisma.ayudanteNegocio.findUnique({
    where: { usuarioId },
    select: {
      estado: true,
      negocio: { select: { id: true, nombre: true, activo: true } },
    },
  });
  if (!ayudante) return null;
  return {
    negocioId: ayudante.negocio.id,
    negocioNombre: ayudante.negocio.nombre,
    negocioActivo: ayudante.negocio.activo,
    estado: ayudante.estado,
  };
}

/** Eventos en los que la participación del negocio fue aceptada por el administrador. */
export async function findEventosAceptados(
  prisma: PrismaService,
  negocioIds: string[],
): Promise<string[]> {
  if (!negocioIds.length) return [];
  const rows = await prisma.solicitudNegocio.findMany({
    where: {
      negocioId: { in: negocioIds },
      estado: SolicitudNegocio_estado.ACEPTADA,
    },
    select: { eventoId: true },
    distinct: ['eventoId'],
  });
  return rows.map((r) => r.eventoId);
}

/** Cantidad de ayudantes activos de los negocios dados. */
export function countAyudantesActivos(
  prisma: PrismaService,
  negocioIds: string[],
) {
  if (!negocioIds.length) return Promise.resolve(0);
  return prisma.ayudanteNegocio.count({
    where: {
      negocioId: { in: negocioIds },
      estado: AyudanteNegocio_estado.ACTIVO,
    },
  });
}

/** Stock de los productos activos de un negocio (`null` = el producto no controla stock). */
export async function findStockNegocio(
  prisma: PrismaService,
  negocioId: string,
): Promise<Map<string, number | null>> {
  const rows = await prisma.producto.findMany({
    where: { negocioId, activo: true },
    select: { id: true, stock: true },
  });
  return new Map(rows.map((r) => [r.id, r.stock]));
}

/**
 * Descuenta el stock de los productos que lo controlan, en una sola sentencia y solo si alcanza
 * para todos (`stock >= cantidad`). Devuelve false si algún producto se quedó sin stock entre la
 * validación y el cobro; en ese caso la transacción del cobro debe revertirse.
 *
 * Se mantiene en SQL a propósito: Prisma no tiene un UPDATE condicional de varias filas con
 * cantidades distintas, y hacerlo producto por producto costaría un viaje a la base remota por
 * cada uno dentro de la transacción del cobro.
 */
export async function descontarStock(
  tx: Prisma.TransactionClient,
  items: { productoId: string; cantidad: number }[],
): Promise<boolean> {
  if (!items.length) return true;
  const cantidad = Prisma.sql`CASE id ${Prisma.join(
    items.map((i) => Prisma.sql`WHEN ${i.productoId} THEN ${i.cantidad}`),
    ' ',
  )} END`;
  const actualizados = await tx.$executeRaw(Prisma.sql`
    UPDATE Producto
    SET stock = stock - ${cantidad}
    WHERE id IN (${Prisma.join(items.map((i) => i.productoId))})
      AND stock IS NOT NULL
      AND stock >= ${cantidad}
  `);
  return actualizados === items.length;
}
