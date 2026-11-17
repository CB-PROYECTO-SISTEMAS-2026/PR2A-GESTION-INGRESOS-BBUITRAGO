import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildPoolRows, TICKET_ESTADO_DISPONIBLE } from './ticket-codes';

type Tx = Prisma.TransactionClient;

const INSERT_BATCH = 1000;
/** Crear o borrar miles de códigos en la base remota supera el límite por defecto de las transacciones. */
export const POOL_TX_TIMEOUT_MS = 120_000;

/** Un código deja de estar disponible cuando se asigna a una entrada. */
export const asignadoWhere: Prisma.TicketPoolWhereInput = {
  OR: [
    { estado: { not: TICKET_ESTADO_DISPONIBLE } },
    { entrada: { isNot: null } },
  ],
};

/**
 * El cupo de una categoría es la cantidad de entradas que se venden POR DÍA: en un evento de varios
 * días se venden `cupo` entradas en cada día en que la categoría es válida, y cada una necesita su
 * propio código QR. Por eso el pool tiene `cupo × días` códigos.
 */
export async function codigosNecesarios(tx: Tx, categoriaId: string) {
  const categoria = await tx.categoriaEntrada.findUniqueOrThrow({
    where: { id: categoriaId },
    select: {
      cupo: true,
      _count: {
        select: { fechasDisponibles: { where: { disponible: true } } },
      },
    },
  });
  return categoria.cupo * Math.max(1, categoria._count.fechasDisponibles);
}

/** Deja el pool con los códigos que necesita la categoría, sin tocar los ya asignados a una entrada. */
export async function sincronizarPool(tx: Tx, categoriaId: string) {
  const necesarios = await codigosNecesarios(tx, categoriaId);
  const total = await tx.ticketPool.count({ where: { categoriaId } });
  if (total < necesarios) {
    await agregarCodigos(tx, categoriaId, necesarios - total);
    return;
  }
  if (total === necesarios) return;

  const asignados = await tx.ticketPool.count({
    where: { categoriaId, ...asignadoWhere },
  });
  if (necesarios < asignados) {
    throw new ConflictException(
      `Ya se vendieron ${asignados.toLocaleString('es-BO')} entradas de esta categoría entre todos sus días. No puede quedar con menos.`,
    );
  }
  const sobrantes = await tx.ticketPool.findMany({
    where: {
      categoriaId,
      estado: TICKET_ESTADO_DISPONIBLE,
      entrada: { is: null },
    },
    orderBy: { createdAt: 'desc' },
    take: total - necesarios,
    select: { id: true },
  });
  for (let i = 0; i < sobrantes.length; i += INSERT_BATCH) {
    await tx.ticketPool.deleteMany({
      where: {
        id: { in: sobrantes.slice(i, i + INSERT_BATCH).map((s) => s.id) },
      },
    });
  }
}

/**
 * Agrega al pool los códigos que faltan para emitir `faltan` entradas, sin pasar de los que la
 * categoría necesita. Cubre las categorías creadas cuando el pool tenía solo `cupo` códigos.
 */
export async function completarPool(
  tx: Tx,
  categoriaId: string,
  faltan: number,
) {
  const [necesarios, total] = await Promise.all([
    codigosNecesarios(tx, categoriaId),
    tx.ticketPool.count({ where: { categoriaId } }),
  ]);
  const agregar = Math.min(faltan, necesarios - total);
  if (agregar > 0) await agregarCodigos(tx, categoriaId, agregar);
  return Math.max(0, agregar);
}

async function agregarCodigos(tx: Tx, categoriaId: string, cantidad: number) {
  let pendientes = cantidad;
  while (pendientes > 0) {
    const lote = Math.min(pendientes, INSERT_BATCH);
    const { count } = await tx.ticketPool.createMany({
      data: buildPoolRows(categoriaId, lote),
      skipDuplicates: true,
    });
    pendientes -= count;
  }
}

/** Entradas que suman las categorías válidas en cada día del evento; no puede pasar la capacidad. */
export function cuposPorDia(
  categorias: Array<{ cupo: number; fechasDisponibles: { fechaId: string }[] }>,
) {
  const porDia = new Map<string, number>();
  for (const c of categorias) {
    for (const { fechaId } of c.fechasDisponibles) {
      porDia.set(fechaId, (porDia.get(fechaId) ?? 0) + c.cupo);
    }
  }
  return porDia;
}

export const claveDia = (categoriaId: string, fechaId: string | null) =>
  `${categoriaId}:${fechaId ?? ''}`;
