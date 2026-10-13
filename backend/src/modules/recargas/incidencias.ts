import { EstadoIncidencia, Prisma } from '@prisma/client';

/** Campos de la incidencia más reciente que acompañan a cada recarga en los historiales. */
export const ULTIMA_INCIDENCIA = {
  orderBy: { createdAt: 'desc' },
  take: 1,
  select: {
    id: true,
    tipo: true,
    descripcion: true,
    estado: true,
    resolucion: true,
    createdAt: true,
    resueltaAt: true,
  },
} satisfies Prisma.TransaccionSaldo$incidenciasArgs;

type IncidenciaFila = Prisma.IncidenciaRecargaGetPayload<{
  select: (typeof ULTIMA_INCIDENCIA)['select'];
}>;

export function incidenciaDto(i: IncidenciaFila | undefined) {
  if (!i) return null;
  return {
    id: i.id,
    tipo: i.tipo,
    descripcion: i.descripcion,
    estado: i.estado,
    abierta: i.estado === EstadoIncidencia.ABIERTA,
    resolucion: i.resolucion,
    fecha: i.createdAt,
    resueltaAt: i.resueltaAt,
  };
}
