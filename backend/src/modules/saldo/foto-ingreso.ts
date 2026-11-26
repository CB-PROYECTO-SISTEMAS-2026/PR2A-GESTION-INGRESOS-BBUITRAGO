import { AccesoTipo, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Foto del primer ingreso del cliente al evento (HU-046 / HU-048). Se prefiere la de la entrada
 * escaneada; si con esa entrada nunca ingresó (p. ej. evento de varios días), se usa la más
 * antigua de otra entrada suya del mismo evento. Null si no tiene ninguna.
 */
export async function fotoPrimerIngreso(
  prisma: PrismaService,
  usuarioId: string,
  eventoId: string,
  entradaId: string,
) {
  const buscar = (entrada: Prisma.AccesoEventoWhereInput) =>
    prisma.accesoEvento.findFirst({
      where: {
        eventoId,
        tipo: AccesoTipo.INGRESO,
        fotoIngresoUrl: { not: null },
        ...entrada,
      },
      orderBy: { createdAt: 'asc' },
      select: { fotoIngresoUrl: true, createdAt: true },
    });

  const foto =
    (await buscar({ entradaId, entrada: { titularId: usuarioId } })) ??
    (await buscar({ entrada: { titularId: usuarioId } }));

  return foto ? { url: foto.fotoIngresoUrl!, tomadaAt: foto.createdAt } : null;
}
