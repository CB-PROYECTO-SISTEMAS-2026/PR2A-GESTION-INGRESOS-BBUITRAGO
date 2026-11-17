import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EntradaEstado,
  EstadoTransaccion,
  EventoEstado,
  Prisma,
  Role,
  TipoTransaccionSaldo,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { dateToDay, todayIn } from '../events/event-schedule';
import { resolveDayRange } from '../pos/pos-dates';
import { codigoTransaccion, money, nombreCompleto } from '../pos/pos-helpers';
import { MisMovimientosDto, MovimientosEventoDto } from './dto/movimientos.dto';
import {
  estadoTemporal,
  montoConSigno,
  type EstadoTemporalEvento,
} from './saldo-helpers';

/** Movimientos que se muestran al cliente por evento (los eventos rara vez llegan a tanto). */
const MIS_MOVIMIENTOS_LIMIT = 300;
const PAGE_SIZE = 50;

/** Descripción por defecto de cada tipo cuando el movimiento no tiene nota. */
const OPERACION: Record<TipoTransaccionSaldo, string> = {
  RECARGA: 'Recarga de saldo',
  COMPRA_PRODUCTO: 'Compra en punto de venta',
  DEVOLUCION: 'Devolución de saldo',
  AJUSTE: 'Ajuste de saldo',
};

/** Orden de las tarjetas de "Mis saldos": lo que está pasando primero, lo finalizado al final. */
const ORDEN_ESTADO: Record<EstadoTemporalEvento, number> = {
  EN_CURSO: 0,
  HOY: 1,
  PROXIMO: 2,
  FINALIZADO: 3,
};

const MOVIMIENTO_SELECT = {
  id: true,
  createdAt: true,
  tipo: true,
  monto: true,
  saldoResultante: true,
  estado: true,
  nota: true,
} satisfies Prisma.TransaccionSaldoSelect;

type MovimientoRow = Prisma.TransaccionSaldoGetPayload<{
  select: typeof MOVIMIENTO_SELECT;
}>;

function toMovimiento(m: MovimientoRow) {
  return {
    id: m.id,
    codigo: codigoTransaccion(m.id),
    fecha: m.createdAt,
    tipo: m.tipo,
    operacion: m.nota || OPERACION[m.tipo],
    /** Con signo, desde el punto de vista del cliente: + entra saldo, − sale saldo. */
    monto: money(montoConSigno(m.tipo, m.monto)),
    saldoResultante: money(m.saldoResultante),
    estado: m.estado,
  };
}

/**
 * HU-020: saldo y movimientos por evento. Cada evento tiene su propio saldo; los movimientos
 * nunca se mezclan entre eventos.
 */
@Injectable()
export class MovimientosService {
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  /** "Mis saldos": eventos donde el cliente tiene saldo o una entrada válida. */
  async misSaldos(usuarioId: string) {
    const eventos = await this.prisma.evento.findMany({
      where: {
        estado: {
          in: [
            EventoEstado.PUBLICADO,
            EventoEstado.FINALIZADO,
            EventoEstado.CANCELADO,
          ],
        },
        OR: [
          { saldos: { some: { usuarioId } } },
          {
            entradas: {
              some: {
                titularId: usuarioId,
                estado: {
                  notIn: [EntradaEstado.REEMBOLSADA, EntradaEstado.ANULADA],
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        titulo: true,
        fotoUrl: true,
        estado: true,
        fechas: {
          select: { fecha: true, horaInicio: true, horaFin: true },
          orderBy: { fecha: 'asc' },
        },
        saldos: {
          where: { usuarioId },
          select: { saldo: true, updatedAt: true },
        },
      },
    });

    const today = todayIn(this.timeZone);
    const now = new Date();
    const saldos = eventos.map((e) => {
      const dias = e.fechas.map((f) => dateToDay(f.fecha));
      const saldo = e.saldos[0];
      return {
        eventoId: e.id,
        titulo: e.titulo,
        fotoUrl: e.fotoUrl,
        fechaInicio: dias[0] ?? null,
        fechaFin: dias[dias.length - 1] ?? null,
        momento:
          e.estado === EventoEstado.PUBLICADO
            ? estadoTemporal(e.fechas, today, this.timeZone, now)
            : ('FINALIZADO' as const),
        cancelado: e.estado === EventoEstado.CANCELADO,
        saldo: money(saldo?.saldo),
        actualizado: saldo?.updatedAt ?? null,
      };
    });
    saldos.sort(
      (a, b) =>
        ORDEN_ESTADO[a.momento] - ORDEN_ESTADO[b.momento] ||
        (a.momento === 'FINALIZADO'
          ? (b.fechaFin ?? '').localeCompare(a.fechaFin ?? '')
          : (a.fechaInicio ?? '').localeCompare(b.fechaInicio ?? '')),
    );
    return { saldos };
  }

  /** Historial del cliente en un evento, del más reciente al más antiguo. */
  async misMovimientos(usuarioId: string, dto: MisMovimientosDto) {
    const where: Prisma.TransaccionSaldoWhereInput = {
      usuarioId,
      eventoId: dto.eventoId,
      ...(dto.tipo ? { tipo: dto.tipo } : {}),
    };
    const [evento, saldo, movimientos, cantidad] = await Promise.all([
      this.prisma.evento.findUnique({
        where: { id: dto.eventoId },
        select: { id: true, titulo: true },
      }),
      this.prisma.saldoEvento.findUnique({
        where: { usuarioId_eventoId: { usuarioId, eventoId: dto.eventoId } },
        select: { saldo: true, updatedAt: true },
      }),
      this.prisma.transaccionSaldo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: MIS_MOVIMIENTOS_LIMIT,
        select: MOVIMIENTO_SELECT,
      }),
      this.prisma.transaccionSaldo.count({ where }),
    ]);
    if (!evento) throw new NotFoundException('Evento no encontrado');

    return {
      evento,
      saldo: money(saldo?.saldo),
      actualizado: saldo?.updatedAt ?? null,
      cantidad,
      movimientos: movimientos.map(toMovimiento),
    };
  }

  /**
   * Movimientos de todos los clientes en un evento, para el administrador y el organizador del
   * evento. Incluye totales por tipo y el saldo en circulación.
   *
   * Los totales suman lo que de verdad movió saldo (movimientos COMPLETADOS) con los mismos
   * filtros de tipo y fechas; el filtro de estado solo afecta a la lista.
   */
  async movimientosEvento(
    user: AuthUser,
    eventoId: string,
    dto: MovimientosEventoDto,
  ) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: { id: true, titulo: true, organizadorId: true },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    if (!user.roles.includes(Role.ADMIN) && evento.organizadorId !== user.id) {
      throw new ForbiddenException(
        'Solo puedes ver los movimientos de tus propios eventos.',
      );
    }

    const base: Prisma.TransaccionSaldoWhereInput = {
      eventoId,
      ...(dto.tipo ? { tipo: dto.tipo } : {}),
    };
    if (dto.desde || dto.hasta) {
      const range = resolveDayRange(this.timeZone, dto.desde, dto.hasta);
      base.createdAt = { gte: range.gte, lt: range.lt };
    }
    const where = dto.estado ? { ...base, estado: dto.estado } : base;
    const page = dto.page ?? 1;

    const [movimientos, totalItems, porTipo, enCirculacion] = await Promise.all(
      [
        this.prisma.transaccionSaldo.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: { ...MOVIMIENTO_SELECT, usuarioId: true, operadorId: true },
        }),
        this.prisma.transaccionSaldo.count({ where }),
        this.prisma.transaccionSaldo.groupBy({
          by: ['tipo'],
          where: { ...base, estado: EstadoTransaccion.COMPLETADA },
          _sum: { monto: true },
          _count: { _all: true },
        }),
        this.prisma.saldoEvento.aggregate({
          where: { eventoId },
          _sum: { saldo: true },
        }),
      ],
    );

    const usuarioIds = [
      ...new Set(
        movimientos.flatMap((m) => [m.usuarioId, m.operadorId]).filter(Boolean),
      ),
    ] as string[];
    const usuarios = usuarioIds.length
      ? await this.prisma.usuario.findMany({
          where: { id: { in: usuarioIds } },
          select: { id: true, nombre: true, apellido: true },
        })
      : [];
    const nombre = new Map(usuarios.map((u) => [u.id, nombreCompleto(u)]));

    const totales = Object.fromEntries(
      Object.values(TipoTransaccionSaldo).map((tipo) => {
        const fila = porTipo.find((t) => t.tipo === tipo);
        return [
          tipo,
          {
            cantidad: fila?._count._all ?? 0,
            monto: money(
              fila?._sum.monto
                ? montoConSigno(tipo, fila._sum.monto)
                : undefined,
            ),
          },
        ];
      }),
    ) as Record<TipoTransaccionSaldo, { cantidad: number; monto: string }>;

    return {
      evento: { id: evento.id, titulo: evento.titulo },
      page,
      pageSize: PAGE_SIZE,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / PAGE_SIZE)),
      totales,
      /** Suma de los saldos actuales de todos los clientes en el evento (sin filtros). */
      saldoEnCirculacion: money(enCirculacion._sum.saldo),
      movimientos: movimientos.map((m) => ({
        ...toMovimiento(m),
        cliente: nombre.get(m.usuarioId) ?? 'Cliente',
        operador: (m.operadorId && nombre.get(m.operadorId)) || null,
      })),
    };
  }
}
