import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CompraEstado, EntradaEstado, Prisma, TipoAcceso } from '@prisma/client';
import { normalizeEmail } from '../../common/security/user-identity';
import { TICKET_ESTADO_ASIGNADO, TICKET_ESTADO_DISPONIBLE } from '../tickets/ticket-codes';

type Tx = Prisma.TransactionClient;

/** El QR se asigna al perfil del titular en cuanto se aprueba la compra (HU-055). */
export const ACCESO_CON_QR_DIGITAL: TipoAcceso[] = [TipoAcceso.QR_DIGITAL, TipoAcceso.AMBOS];
/** El titular recoge una manilla física en un punto de entrega (HU-015, HU-053). */
export const ACCESO_CON_MANILLA: TipoAcceso[] = [TipoAcceso.MANILLA, TipoAcceso.AMBOS];
export const ENTRADA_INVALIDA: EntradaEstado[] = [EntradaEstado.ANULADA, EntradaEstado.REEMBOLSADA];

const entradaEmitidaSelect = {
  id: true,
  codigo: true,
  estado: true,
  titularId: true,
  fechaId: true,
  categoria: { select: { nombre: true } },
  fecha: { select: { fecha: true } },
  credencial: { select: { activa: true } },
} satisfies Prisma.EntradaSelect;

type EntradaEmitida = Prisma.EntradaGetPayload<{ select: typeof entradaEmitidaSelect }>;

export interface EmisionResultado {
  compraId: string;
  tipoAcceso: TipoAcceso;
  entradas: Array<{
    id: string;
    codigo: string;
    estado: EntradaEstado;
    categoria: string;
    titularId: string | null;
    fechaId: string | null;
    fecha: Date | null;
    asignadaAlPerfil: boolean;
  }>;
}

/**
 * HU-014 / HU-055: genera una entrada con QR único por cada unidad de una compra aprobada.
 * - El código sale del pool pregenerado de la categoría (HU-041), así nunca se repite.
 * - Cada entrada queda asociada al día elegido; en eventos de un día, a su única fecha.
 *   Sin día elegido en un evento de varios días, la entrada vale para los días de su categoría.
 * - Eventos QR Digital o Ambos: el QR queda asignado al perfil del titular (Credencial activa).
 *   Eventos con Manilla: la entrada espera a que un supervisor le vincule la manilla.
 * Es idempotente: si la compra ya tiene entradas, las devuelve sin crear nuevas.
 */
export async function emitirEntradasDeCompra(tx: Tx, compraId: string): Promise<EmisionResultado> {
  const compra = await tx.compraEntrada.findUnique({
    where: { id: compraId },
    select: {
      id: true,
      estado: true,
      usuarioId: true,
      eventoId: true,
      evento: { select: { tipoAcceso: true, fechas: { select: { id: true } } } },
      items: {
        orderBy: { id: 'asc' },
        select: {
          categoriaId: true,
          fechaId: true,
          cantidad: true,
          paraEmail: true,
          categoria: {
            select: {
              nombre: true,
              eventoId: true,
              fechasDisponibles: { where: { disponible: true }, select: { fechaId: true } },
            },
          },
        },
      },
      _count: { select: { entradas: true } },
    },
  });
  if (!compra) throw new NotFoundException('Compra no encontrada');
  if (compra.estado !== CompraEstado.APROBADA) {
    throw new BadRequestException('Las entradas solo se generan cuando la compra está aprobada.');
  }
  const tipoAcceso = compra.evento.tipoAcceso;

  if (compra._count.entradas > 0) {
    const existentes = await tx.entrada.findMany({
      where: { compraId },
      orderBy: { createdAt: 'asc' },
      select: entradaEmitidaSelect,
    });
    return { compraId, tipoAcceso, entradas: existentes.map(presentar) };
  }
  if (!compra.items.length) throw new BadRequestException('La compra no tiene entradas.');

  const fechasEvento = compra.evento.fechas.map((f) => f.id);
  const unidades = compra.items.map((item) => {
    if (item.categoria.eventoId !== compra.eventoId) {
      throw new BadRequestException(`La categoría "${item.categoria.nombre}" no pertenece al evento de la compra.`);
    }
    if (!Number.isInteger(item.cantidad) || item.cantidad < 1) {
      throw new BadRequestException(`La cantidad de entradas "${item.categoria.nombre}" no es válida.`);
    }
    return { ...item, fechaId: resolverFecha(item, fechasEvento) };
  });

  const titulares = await resolverTitulares(tx, unidades);
  const porCategoria = new Map<string, { nombre: string; cantidad: number }>();
  for (const u of unidades) {
    const acc = porCategoria.get(u.categoriaId) ?? { nombre: u.categoria.nombre, cantidad: 0 };
    acc.cantidad += u.cantidad;
    porCategoria.set(u.categoriaId, acc);
  }
  const codigos = new Map<string, Array<{ id: string; codigo: string; codigoQr: string }>>();
  for (const [categoriaId, { nombre, cantidad }] of porCategoria) {
    codigos.set(categoriaId, await reservarCodigos(tx, categoriaId, cantidad, nombre));
  }

  const digital = ACCESO_CON_QR_DIGITAL.includes(tipoAcceso);
  const creadas: EntradaEmitida[] = [];
  for (const u of unidades) {
    const titularId = u.paraEmail ? (titulares.get(normalizeEmail(u.paraEmail)) ?? null) : compra.usuarioId;
    const asignar = digital && Boolean(titularId);
    for (let i = 0; i < u.cantidad; i++) {
      const codigo = codigos.get(u.categoriaId)!.shift()!;
      creadas.push(
        await tx.entrada.create({
          data: {
            compraId,
            eventoId: compra.eventoId,
            categoriaId: u.categoriaId,
            fechaId: u.fechaId,
            titularId,
            ticketPoolId: codigo.id,
            codigo: codigo.codigo,
            codigoQr: codigo.codigoQr,
            estado: asignar ? EntradaEstado.ASIGNADA : EntradaEstado.GENERADA,
            ...(asignar ? { credencial: { create: { codigoQr: codigo.codigoQr } } } : {}),
          },
          select: entradaEmitidaSelect,
        }),
      );
    }
  }
  return { compraId, tipoAcceso, entradas: creadas.map(presentar) };
}

function presentar(e: EntradaEmitida): EmisionResultado['entradas'][number] {
  return {
    id: e.id,
    codigo: e.codigo,
    estado: e.estado,
    categoria: e.categoria.nombre,
    titularId: e.titularId,
    fechaId: e.fechaId,
    fecha: e.fecha?.fecha ?? null,
    asignadaAlPerfil: Boolean(e.credencial?.activa),
  };
}

function resolverFecha(
  item: { fechaId: string | null; categoria: { nombre: string; fechasDisponibles: { fechaId: string }[] } },
  fechasEvento: string[],
) {
  if (item.fechaId) {
    if (!item.categoria.fechasDisponibles.some((f) => f.fechaId === item.fechaId)) {
      throw new BadRequestException(`La categoría "${item.categoria.nombre}" no está disponible el día seleccionado.`);
    }
    return item.fechaId;
  }
  return fechasEvento.length === 1 ? fechasEvento[0] : null;
}

/**
 * Las entradas para terceros (HU-011) quedan a nombre de la cuenta con ese correo, si existe.
 * Si la persona aún no tiene cuenta, la entrada se emite sin titular y no se asigna a ningún perfil.
 */
async function resolverTitulares(tx: Tx, unidades: Array<{ paraEmail: string | null }>) {
  const emails = [...new Set(unidades.filter((u) => u.paraEmail).map((u) => normalizeEmail(u.paraEmail!)))];
  const titulares = new Map<string, string>();
  if (!emails.length) return titulares;
  const usuarios = await tx.usuario.findMany({
    where: { email: { in: emails }, activo: true, eliminadoAt: null },
    select: { id: true, email: true },
  });
  for (const u of usuarios) titulares.set(normalizeEmail(u.email), u.id);
  return titulares;
}

/** Toma `cantidad` códigos libres del pool de la categoría y los marca como asignados en el mismo paso. */
async function reservarCodigos(tx: Tx, categoriaId: string, cantidad: number, nombre: string) {
  const libres = await tx.ticketPool.findMany({
    where: { categoriaId, estado: TICKET_ESTADO_DISPONIBLE, entrada: { is: null } },
    orderBy: [{ createdAt: 'asc' }, { codigo: 'asc' }],
    take: cantidad,
    select: { id: true, codigo: true, codigoQr: true },
  });
  if (libres.length < cantidad) {
    throw new ConflictException(
      `No quedan suficientes entradas "${nombre}": se pidieron ${cantidad} y hay ${libres.length} disponibles.`,
    );
  }
  const { count } = await tx.ticketPool.updateMany({
    where: { id: { in: libres.map((c) => c.id) }, estado: TICKET_ESTADO_DISPONIBLE },
    data: { estado: TICKET_ESTADO_ASIGNADO },
  });
  if (count !== cantidad) {
    throw new ConflictException('Otra compra se aprobó al mismo tiempo con las mismas entradas. Intenta de nuevo.');
  }
  return libres;
}
