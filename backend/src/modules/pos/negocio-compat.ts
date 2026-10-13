import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/*
 * TEMPORAL — compatibilidad con la base compartida.
 *
 * La base de Aiven ya tiene la nueva estructura de negocios (SolicitudNegocio, AyudanteNegocio.estado,
 * Negocio sin eventoId, Producto.stock), pero el schema.prisma de esta rama todavía no. Estas consultas leen esas
 * columnas con SQL parametrizado; cuando se integre el schema nuevo (`npm run db:sync`) se pueden
 * reemplazar por consultas tipadas de Prisma sin cambiar el resto del módulo.
 *
 * Fuera de este archivo, el módulo solo selecciona columnas que existen en ambas versiones
 * (Negocio: id, nombre, duenoId, activo · AyudanteNegocio: id, negocioId, usuarioId).
 */

export const AYUDANTE_ACTIVO = 'ACTIVO';
export const SOLICITUD_ACEPTADA = 'ACEPTADA';

export interface AyudanteAsignacion {
  negocioId: string;
  negocioNombre: string;
  negocioActivo: boolean;
  estado: string;
}

/** Negocio al que pertenece el ayudante y estado de su asignación. */
export async function findAyudanteAsignacion(
  prisma: PrismaService,
  usuarioId: string,
): Promise<AyudanteAsignacion | null> {
  const rows = await prisma.$queryRaw<
    {
      negocioId: string;
      negocioNombre: string;
      negocioActivo: number | boolean;
      estado: string;
    }[]
  >(Prisma.sql`
    SELECT a.negocioId, n.nombre AS negocioNombre, n.activo AS negocioActivo, a.estado
    FROM AyudanteNegocio a
    JOIN Negocio n ON n.id = a.negocioId
    WHERE a.usuarioId = ${usuarioId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return { ...row, negocioActivo: Boolean(row.negocioActivo) };
}

/** Eventos en los que la participación del negocio fue aceptada por el administrador. */
export async function findEventosAceptados(
  prisma: PrismaService,
  negocioIds: string[],
): Promise<string[]> {
  if (!negocioIds.length) return [];
  const rows = await prisma.$queryRaw<{ eventoId: string }[]>(Prisma.sql`
    SELECT DISTINCT eventoId
    FROM SolicitudNegocio
    WHERE negocioId IN (${Prisma.join(negocioIds)}) AND estado = ${SOLICITUD_ACEPTADA}
  `);
  return rows.map((r) => r.eventoId);
}

/** Cantidad de ayudantes activos de los negocios dados. */
export async function countAyudantesActivos(
  prisma: PrismaService,
  negocioIds: string[],
) {
  if (!negocioIds.length) return 0;
  const rows = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS total
    FROM AyudanteNegocio
    WHERE negocioId IN (${Prisma.join(negocioIds)}) AND estado = ${AYUDANTE_ACTIVO}
  `);
  return Number(rows[0]?.total ?? 0);
}

/** Stock de los productos activos de un negocio (`null` = el producto no controla stock). */
export async function findStockNegocio(
  prisma: PrismaService,
  negocioId: string,
): Promise<Map<string, number | null>> {
  const rows = await prisma.$queryRaw<
    { id: string; stock: number | bigint | null }[]
  >(Prisma.sql`
    SELECT id, stock FROM Producto WHERE negocioId = ${negocioId} AND activo = 1
  `);
  return new Map(
    rows.map((r) => [r.id, r.stock === null ? null : Number(r.stock)]),
  );
}

/**
 * Descuenta el stock de los productos que lo controlan, en una sola sentencia y solo si alcanza
 * para todos (`stock >= cantidad`). Devuelve false si algún producto se quedó sin stock entre la
 * validación y el cobro; en ese caso la transacción del cobro debe revertirse.
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
