import {
  CompraEstado,
  EntradaEstado,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { normalizeEmail } from '../../common/security/user-identity';
import {
  ACCESO_CON_QR_DIGITAL,
  EmisionResultado,
  ENTRADA_INVALIDA,
} from '../entradas/entradas-emision';

type Tx = Prisma.TransactionClient;

/**
 * HU-011: al aprobar la compra, cada entrada para un tercero queda ligada a la línea de compra que
 * guarda sus datos. La emisión recorre los ítems por id y crea sus entradas en ese mismo orden.
 */
export async function vincularEntradasDeTerceros(
  tx: Tx,
  compraId: string,
  emision: EmisionResultado,
) {
  const items = await tx.compraEntradaItem.findMany({
    where: { compraId },
    orderBy: { id: 'asc' },
    select: { id: true, cantidad: true, paraEmail: true },
  });
  let i = 0;
  for (const item of items) {
    const entradas = emision.entradas.slice(i, i + item.cantidad);
    i += item.cantidad;
    if (item.paraEmail && entradas.length === 1) {
      await tx.compraEntradaItem.update({
        where: { id: item.id },
        data: { entradaId: entradas[0].id },
      });
    }
  }
}

/**
 * HU-011: una entrada comprada para alguien que aún no tenía cuenta se emite sin titular. Cuando esa
 * persona entra con el mismo correo, la entrada pasa a su perfil (y recibe su QR digital si el evento lo usa).
 */
export async function asignarEntradasDeTerceros(
  prisma: PrismaClient,
  usuarioId: string,
) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { email: true, activo: true, eliminadoAt: true },
  });
  if (!usuario?.activo || usuario.eliminadoAt) return 0;

  const pendientes = await prisma.compraEntradaItem.findMany({
    where: {
      paraEmail: normalizeEmail(usuario.email),
      compra: { estado: CompraEstado.APROBADA },
      entrada: { is: { titularId: null } },
    },
    select: {
      entrada: {
        select: {
          id: true,
          estado: true,
          codigoQr: true,
          evento: { select: { tipoAcceso: true } },
          credencial: { select: { id: true } },
        },
      },
    },
  });

  let asignadas = 0;
  for (const { entrada } of pendientes) {
    if (!entrada || ENTRADA_INVALIDA.includes(entrada.estado)) continue;
    const digital = ACCESO_CON_QR_DIGITAL.includes(entrada.evento.tipoAcceso);
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.entrada.updateMany({
        where: { id: entrada.id, titularId: null },
        data: {
          titularId: usuarioId,
          ...(digital && entrada.estado === EntradaEstado.GENERADA
            ? { estado: EntradaEstado.ASIGNADA }
            : {}),
        },
      });
      if (count && digital && !entrada.credencial) {
        await tx.credencial.create({
          data: { entradaId: entrada.id, codigoQr: entrada.codigoQr },
        });
      }
      asignadas += count;
    });
  }
  return asignadas;
}
