import { Prisma } from '@prisma/client';

export function nombreCompleto(u: { nombre: string; apellido: string | null } | null | undefined) {
  if (!u) return null;
  return [u.nombre, u.apellido].filter(Boolean).join(' ');
}

const personaSelect = { id: true, nombre: true, apellido: true, email: true } as const;

/** Una manilla entregada: en qué punto, por cuál supervisor y a qué entrada/cliente (HU-053). */
export const entregaSelect = {
  id: true,
  codigoFisico: true,
  vinculadaAt: true,
  puntoRetiro: { select: { id: true, nombre: true } },
  entregadaPor: { select: personaSelect },
  entrada: {
    select: {
      id: true,
      codigo: true,
      categoria: { select: { nombre: true } },
      fecha: { select: { fecha: true } },
      titular: { select: personaSelect },
    },
  },
} satisfies Prisma.ManillaSelect;

type Entrega = Prisma.ManillaGetPayload<{ select: typeof entregaSelect }>;

export function presentarEntrega(m: Entrega) {
  return {
    id: m.id,
    codigoManilla: m.codigoFisico,
    entregadaAt: m.vinculadaAt,
    puntoRetiro: m.puntoRetiro,
    supervisor: m.entregadaPor ? { id: m.entregadaPor.id, nombre: nombreCompleto(m.entregadaPor) } : null,
    entrada: m.entrada
      ? {
          id: m.entrada.id,
          codigo: m.entrada.codigo,
          categoria: m.entrada.categoria.nombre,
          fecha: m.entrada.fecha?.fecha ?? null,
        }
      : null,
    cliente: m.entrada?.titular
      ? { id: m.entrada.titular.id, nombre: nombreCompleto(m.entrada.titular), email: m.entrada.titular.email }
      : null,
  };
}
