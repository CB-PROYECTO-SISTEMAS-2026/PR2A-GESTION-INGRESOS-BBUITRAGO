import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompraEstado, EventoEstado, Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeList } from '../events/event-content';
import {
  CreateCategoriaDto,
  ListCodigosQuery,
  UpdateCategoriaDto,
} from './dto/tickets.dto';
import {
  asignadoWhere,
  claveDia,
  cuposPorDia,
  POOL_TX_TIMEOUT_MS,
  sincronizarPool,
} from './cupos';
import { TICKET_ESTADO_DISPONIBLE } from './ticket-codes';

const CODIGOS_POR_PAGINA = 24;

const categoriaInclude = {
  fechasDisponibles: true,
  _count: { select: { ticketsPool: true } },
} satisfies Prisma.CategoriaEntradaInclude;

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async createCategoria(eventoId: string, dto: CreateCategoriaDto) {
    const evento = await this.loadEvento(eventoId);
    const fechaIds = this.resolveFechas(evento, dto.fechaIds);
    this.ensureNombreLibre(evento, dto.nombre);
    this.ensureCapacidad(evento, dto.cupo, fechaIds);

    const created = await this.prisma.$transaction(
      async (tx) => {
        const categoria = await tx.categoriaEntrada.create({
          data: {
            eventoId,
            nombre: dto.nombre,
            precio: dto.precio,
            descuento: dto.descuento ?? 0,
            beneficios: normalizeList(dto.beneficios),
            cupo: dto.cupo,
            fechasDisponibles: {
              create: fechaIds.map((fechaId) => ({
                fechaId,
                disponible: true,
              })),
            },
          },
        });
        await sincronizarPool(tx, categoria.id);
        return categoria;
      },
      { timeout: POOL_TX_TIMEOUT_MS },
    );
    return this.getCategoria(created.id);
  }

  async updateCategoria(id: string, dto: UpdateCategoriaDto) {
    const categoria = await this.ensureCategoria(id);
    const evento = await this.loadEvento(categoria.eventoId);
    const fechaIds =
      dto.fechaIds !== undefined
        ? this.resolveFechas(evento, dto.fechaIds)
        : null;
    if (dto.nombre !== undefined)
      this.ensureNombreLibre(evento, dto.nombre, id);
    const cambiaCupo = dto.cupo !== undefined || fechaIds !== null;
    if (cambiaCupo) {
      const cupo = dto.cupo ?? categoria.cupo;
      const dias =
        fechaIds ??
        evento.categorias
          .find((c) => c.id === id)!
          .fechasDisponibles.map((f) => f.fechaId);
      this.ensureCapacidad(evento, cupo, dias, id);
      await this.ensureVendidasPorDia(id, cupo, dias);
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.categoriaEntrada.update({
          where: { id },
          data: {
            nombre: dto.nombre,
            precio: dto.precio,
            descuento: dto.descuento,
            cupo: dto.cupo,
            ...(dto.beneficios !== undefined
              ? { beneficios: normalizeList(dto.beneficios) }
              : {}),
          },
        });
        if (fechaIds) {
          await tx.categoriaFecha.deleteMany({ where: { categoriaId: id } });
          await tx.categoriaFecha.createMany({
            data: fechaIds.map((fechaId) => ({
              categoriaId: id,
              fechaId,
              disponible: true,
            })),
          });
        }
        if (cambiaCupo) await sincronizarPool(tx, id);
      },
      { timeout: POOL_TX_TIMEOUT_MS },
    );
    return this.getCategoria(id);
  }

  async deleteCategoria(id: string) {
    const categoria = await this.prisma.categoriaEntrada.findUnique({
      where: { id },
      include: {
        evento: {
          select: { estado: true, _count: { select: { categorias: true } } },
        },
        _count: {
          select: {
            entradas: true,
            itemsCompra: true,
            ticketsPool: { where: asignadoWhere },
          },
        },
      },
    });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    const { entradas, itemsCompra, ticketsPool } = categoria._count;
    if (entradas || itemsCompra || ticketsPool) {
      throw new ConflictException(
        'No se puede eliminar esta categoría porque ya tiene entradas vendidas.',
      );
    }
    if (
      categoria.evento.estado === EventoEstado.PUBLICADO &&
      categoria.evento._count.categorias === 1
    ) {
      throw new ConflictException(
        'El evento está publicado y esta es su única categoría. Crea otra categoría o cambia el estado del evento antes de eliminarla.',
      );
    }
    await this.prisma.categoriaEntrada.delete({ where: { id } });
    return { message: 'Categoría eliminada' };
  }

  async listByEvento(eventoId: string) {
    await this.loadEvento(eventoId);
    const categorias = await this.prisma.categoriaEntrada.findMany({
      where: { eventoId },
      orderBy: { precio: 'asc' },
      include: {
        fechasDisponibles: true,
        _count: { select: { ticketsPool: true } },
      },
    });
    const asignados = await this.prisma.ticketPool.groupBy({
      by: ['categoriaId'],
      where: {
        categoriaId: { in: categorias.map((c) => c.id) },
        ...asignadoWhere,
      },
      _count: { _all: true },
    });
    const asignadosPor = new Map(
      asignados.map((a) => [a.categoriaId, a._count._all]),
    );
    return categorias.map((c) => this.present(c, asignadosPor.get(c.id) ?? 0));
  }

  async listCodigos(categoriaId: string, query: ListCodigosQuery) {
    await this.ensureCategoria(categoriaId);
    const pageSize = query.pageSize ?? CODIGOS_POR_PAGINA;
    const total = await this.prisma.ticketPool.count({
      where: { categoriaId },
    });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(query.page ?? 1, totalPages);

    const rows = await this.prisma.ticketPool.findMany({
      where: { categoriaId },
      orderBy: [{ createdAt: 'asc' }, { codigo: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        codigo: true,
        codigoQr: true,
        estado: true,
        entrada: { select: { id: true } },
      },
    });
    const items = await Promise.all(
      rows.map(async (t) => ({
        id: t.id,
        codigo: t.codigo,
        asignado: t.estado !== TICKET_ESTADO_DISPONIBLE || Boolean(t.entrada),
        qr: await QRCode.toDataURL(t.codigoQr, {
          margin: 1,
          width: 320,
          errorCorrectionLevel: 'M',
        }),
      })),
    );
    return { items, total, page, pageSize, totalPages };
  }

  private present<T extends { _count: { ticketsPool: number } }>(
    categoria: T,
    asignados: number,
  ) {
    const { _count, ...rest } = categoria;
    return {
      ...rest,
      codigosTotal: _count.ticketsPool,
      codigosAsignados: asignados,
    };
  }

  private async getCategoria(id: string) {
    const categoria = await this.prisma.categoriaEntrada.findUniqueOrThrow({
      where: { id },
      include: categoriaInclude,
    });
    const asignados = await this.prisma.ticketPool.count({
      where: { categoriaId: id, ...asignadoWhere },
    });
    return this.present(categoria, asignados);
  }

  /**
   * El cupo es por día: no puede quedar por debajo de lo ya vendido (o esperando verificación) en
   * ninguno de los días en que la categoría sigue siendo válida.
   */
  private async ensureVendidasPorDia(
    categoriaId: string,
    cupo: number,
    fechaIds: string[],
  ) {
    const [vendidas, pendientes] = await Promise.all([
      this.prisma.entrada.groupBy({
        by: ['fechaId'],
        where: { categoriaId, fechaId: { in: fechaIds } },
        _count: { _all: true },
      }),
      this.prisma.compraEntradaItem.groupBy({
        by: ['fechaId'],
        where: {
          categoriaId,
          fechaId: { in: fechaIds },
          compra: { estado: CompraEstado.PENDIENTE },
        },
        _sum: { cantidad: true },
      }),
    ]);
    const ocupadas = new Map<string, number>();
    for (const v of vendidas)
      ocupadas.set(claveDia(categoriaId, v.fechaId), v._count._all);
    for (const p of pendientes) {
      const k = claveDia(categoriaId, p.fechaId);
      ocupadas.set(k, (ocupadas.get(k) ?? 0) + (p._sum.cantidad ?? 0));
    }
    const max = Math.max(0, ...ocupadas.values());
    if (cupo < max) {
      throw new ConflictException(
        `Ya se vendieron o reservaron ${max.toLocaleString('es-BO')} entradas de esta categoría para un mismo día. La cantidad por día no puede ser menor.`,
      );
    }
  }

  private async loadEvento(eventoId: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: {
        id: true,
        capacidad: true,
        fechas: { select: { id: true } },
        categorias: {
          select: {
            id: true,
            nombre: true,
            cupo: true,
            fechasDisponibles: {
              where: { disponible: true },
              select: { fechaId: true },
            },
          },
        },
      },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    return evento;
  }

  private resolveFechas(
    evento: { fechas: { id: string }[] },
    fechaIds?: string[],
  ) {
    const validas = new Set(evento.fechas.map((f) => f.id));
    if (evento.fechas.length === 1) return [evento.fechas[0].id];
    const unique = [...new Set(fechaIds ?? [])];
    if (!unique.length)
      throw new BadRequestException(
        'Selecciona al menos un día en que la categoría será válida.',
      );
    if (unique.some((id) => !validas.has(id))) {
      throw new BadRequestException(
        'Alguno de los días seleccionados no pertenece a este evento.',
      );
    }
    return unique;
  }

  private ensureNombreLibre(
    evento: { categorias: { id: string; nombre: string }[] },
    nombre: string,
    exceptId?: string,
  ) {
    const key = nombre.trim().toLocaleLowerCase('es');
    if (
      evento.categorias.some(
        (c) =>
          c.id !== exceptId && c.nombre.trim().toLocaleLowerCase('es') === key,
      )
    ) {
      throw new ConflictException(
        `Ya existe una categoría llamada "${nombre.trim()}" en este evento.`,
      );
    }
  }

  /** La capacidad es por día: en cada día, las categorías válidas no pueden sumar más que ella. */
  private ensureCapacidad(
    evento: {
      capacidad: number | null;
      fechas: { id: string }[];
      categorias: {
        id: string;
        cupo: number;
        fechasDisponibles: { fechaId: string }[];
      }[];
    },
    cupo: number,
    fechaIds: string[],
    exceptId?: string,
  ) {
    if (!evento.capacidad) {
      throw new BadRequestException(
        'Define la capacidad máxima del evento antes de crear categorías.',
      );
    }
    const porDia = cuposPorDia(
      evento.categorias.filter((c) => c.id !== exceptId),
    );
    const usados = Math.max(0, ...fechaIds.map((f) => porDia.get(f) ?? 0));
    const disponibles = evento.capacidad - usados;
    if (cupo > disponibles) {
      const porDiaTexto = evento.fechas.length > 1 ? ' por día' : '';
      throw new BadRequestException(
        `La capacidad máxima del evento es ${evento.capacidad.toLocaleString('es-BO')}${porDiaTexto} y quedan ${Math.max(0, disponibles).toLocaleString('es-BO')} entradas por asignar${evento.fechas.length > 1 ? ' en los días elegidos' : ''}.`,
      );
    }
  }

  private async ensureCategoria(id: string) {
    const cat = await this.prisma.categoriaEntrada.findUnique({
      where: { id },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return cat;
  }
}
