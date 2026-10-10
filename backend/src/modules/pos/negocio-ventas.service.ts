import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventoEstado, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dateToDay, dayToDate, todayIn } from '../events/event-schedule';
import { countAyudantesActivos, findEventosAceptados } from './negocio-compat';
import { dayIn, resolveDayRange } from './pos-dates';
import {
  VENTA_ROW_SELECT,
  VentaRow,
  money,
  nombresDeVentas,
} from './pos-helpers';
import { FiltroVentasNegocioDto, ListadoVentasNegocioDto } from './dto/pos.dto';

const PAGE_SIZE = 25;
const EXPORT_LIMIT = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Estados de RetiroGanancias (columna de texto en el schema). */
export const RETIRO_SOLICITADO = 'SOLICITADO';
const RETIRO_RECHAZADO = 'RECHAZADO';

/** Un evento está cerrado cuando finalizó, se canceló o ya pasó su último día. */
const ESTADOS_CERRADOS: EventoEstado[] = [
  EventoEstado.FINALIZADO,
  EventoEstado.CANCELADO,
];

type Db = Prisma.TransactionClient;

type NombresVentas = Awaited<ReturnType<typeof nombresDeVentas>>;

@Injectable()
export class NegocioVentasService {
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  /** HU-025: métricas de lo recaudado por los puntos de venta del dueño. */
  async resumen(duenoId: string, dto: FiltroVentasNegocioDto) {
    const { negocios, ids } = await this.resolveNegocios(
      duenoId,
      dto.negocioId,
    );
    const range = resolveDayRange(this.timeZone, dto.desde, dto.hasta);
    const where = this.ventasWhere(ids, dto.eventoId, range);

    const [
      ventas,
      productos,
      topProductos,
      ultimas,
      ayudantesActivos,
      eventos,
    ] = await Promise.all([
      this.prisma.venta.findMany({
        where,
        select: { total: true, createdAt: true, eventoId: true },
      }),
      this.prisma.detalleVenta.aggregate({
        where: { venta: where },
        _sum: { cantidad: true },
      }),
      this.prisma.detalleVenta.groupBy({
        by: ['productoId'],
        where: { venta: where },
        _sum: { cantidad: true, subtotal: true },
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 5,
      }),
      this.prisma.venta.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: VENTA_ROW_SELECT,
      }),
      countAyudantesActivos(this.prisma, ids),
      this.eventosDeNegocios(ids),
    ]);

    const total = ventas.reduce(
      (acc, v) => acc.add(v.total),
      new Prisma.Decimal(0),
    );
    const porDia = new Map<string, Prisma.Decimal>();
    const porEvento = new Map<
      string,
      { total: Prisma.Decimal; transacciones: number }
    >();
    for (const v of ventas) {
      const dia = dayIn(v.createdAt, this.timeZone);
      porDia.set(dia, (porDia.get(dia) ?? new Prisma.Decimal(0)).add(v.total));
      const ev = porEvento.get(v.eventoId) ?? {
        total: new Prisma.Decimal(0),
        transacciones: 0,
      };
      porEvento.set(v.eventoId, {
        total: ev.total.add(v.total),
        transacciones: ev.transacciones + 1,
      });
    }

    const [nombresProducto, nombres] = await Promise.all([
      this.prisma.producto.findMany({
        where: { id: { in: topProductos.map((t) => t.productoId) } },
        select: { id: true, nombre: true },
      }),
      nombresDeVentas(this.prisma, ultimas),
    ]);
    const titulos = new Map(eventos.map((e) => [e.id, e.titulo]));

    return {
      desde: range.desde,
      hasta: range.hasta,
      negocios,
      eventos,
      kpis: {
        ventasTotales: money(total),
        transacciones: ventas.length,
        ticketPromedio: money(ventas.length ? total.div(ventas.length) : 0),
        productosVendidos: productos._sum.cantidad ?? 0,
        ayudantesActivos,
      },
      ventasPorDia: this.diasDelRango(range.desde, range.hasta).map((dia) => ({
        dia,
        total: money(porDia.get(dia)),
      })),
      porEvento: [...porEvento.entries()]
        .map(([eventoId, v]) => ({
          eventoId,
          titulo: titulos.get(eventoId) ?? 'Evento',
          total: money(v.total),
          transacciones: v.transacciones,
        }))
        .sort((a, b) => Number(b.total) - Number(a.total)),
      topProductos: topProductos.map((t) => ({
        productoId: t.productoId,
        nombre:
          nombresProducto.find((p) => p.id === t.productoId)?.nombre ??
          'Producto',
        cantidad: t._sum.cantidad ?? 0,
        total: money(t._sum.subtotal),
      })),
      ultimasVentas: ultimas.map((v) => ({
        id: v.id,
        fecha: v.createdAt,
        total: money(v.total),
        cliente: nombres.cliente(v),
        productos: nombres.productos(v),
      })),
    };
  }

  /** Registro de ventas paginado. */
  async ventas(duenoId: string, dto: ListadoVentasNegocioDto) {
    const { ids } = await this.resolveNegocios(duenoId, dto.negocioId);
    const range = resolveDayRange(this.timeZone, dto.desde, dto.hasta);
    const where = this.ventasWhere(ids, dto.eventoId, range);
    const page = dto.page ?? 1;

    const [items, resumen] = await Promise.all([
      this.prisma.venta.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: VENTA_ROW_SELECT,
      }),
      this.prisma.venta.aggregate({
        where,
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);
    const nombres = await nombresDeVentas(this.prisma, items);

    return {
      desde: range.desde,
      hasta: range.hasta,
      page,
      pageSize: PAGE_SIZE,
      totalItems: resumen._count._all,
      totalRecaudado: money(resumen._sum.total),
      items: items.map((v) => this.toVentaRow(v, nombres)),
    };
  }

  /** CSV (separado por ";" y con BOM para que Excel respete los acentos). */
  async exportarCsv(duenoId: string, dto: FiltroVentasNegocioDto) {
    const { ids } = await this.resolveNegocios(duenoId, dto.negocioId);
    const range = resolveDayRange(this.timeZone, dto.desde, dto.hasta);
    const ventas = await this.prisma.venta.findMany({
      where: this.ventasWhere(ids, dto.eventoId, range),
      orderBy: { createdAt: 'asc' },
      take: EXPORT_LIMIT,
      select: VENTA_ROW_SELECT,
    });
    const nombres = await nombresDeVentas(this.prisma, ventas);
    const hora = new Intl.DateTimeFormat('es-BO', {
      timeZone: this.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const header = [
      'Fecha',
      'Hora',
      'Negocio',
      'Evento',
      'Cliente',
      'Ayudante',
      'Productos',
      'Total (Bs)',
    ];
    const rows = ventas.map((v) => {
      const row = this.toVentaRow(v, nombres);
      return [
        dayIn(v.createdAt, this.timeZone),
        hora.format(v.createdAt),
        row.negocio,
        row.evento,
        row.cliente,
        row.ayudante,
        row.productos,
        row.total,
      ];
    });
    const csv = [header, ...rows]
      .map((r) => r.map(csvCell).join(';'))
      .join('\r\n');
    return {
      filename: `ventas_${range.desde}_${range.hasta}.csv`,
      content: `\uFEFF${csv}\r\n`,
    };
  }

  /**
   * HU-025: lo vendido en eventos cerrados queda acreditado al dueño del negocio y puede
   * solicitarse como retiro; lo vendido en eventos en curso queda pendiente hasta el cierre.
   */
  async liquidacion(duenoId: string, negocioId?: string) {
    const { negocios, ids } = await this.resolveNegocios(duenoId, negocioId);
    const [balances, retiros] = await Promise.all([
      this.calcularBalances(this.prisma, ids),
      this.prisma.retiroGanancias.findMany({
        where: { negocioId: { in: ids } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          negocioId: true,
          monto: true,
          estado: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      negocios: negocios.map((n) => {
        const b = balances.get(n.id)!;
        return {
          id: n.id,
          nombre: n.nombre,
          acreditado: money(b.acreditado),
          pendienteCierre: money(b.pendiente),
          retirado: money(b.retirado),
          disponible: money(b.disponible),
          eventos: b.eventos,
          retiros: retiros
            .filter((r) => r.negocioId === n.id)
            .map((r) => ({
              id: r.id,
              monto: money(r.monto),
              estado: r.estado,
              fecha: r.createdAt,
            })),
        };
      }),
    };
  }

  /** Solicita el retiro de todo lo disponible del negocio. */
  async solicitarRetiro(duenoId: string, negocioId: string) {
    await this.resolveNegocios(duenoId, negocioId);
    const retiro = await this.prisma.$transaction(async (tx) => {
      // Bloquea el negocio para que dos solicitudes simultáneas no retiren el mismo saldo.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM Negocio WHERE id = ${negocioId} FOR UPDATE`,
      );
      const balance = (await this.calcularBalances(tx, [negocioId])).get(
        negocioId,
      )!;
      if (balance.disponible.lte(0)) {
        throw new BadRequestException(
          'No hay ventas de eventos cerrados disponibles para retirar.',
        );
      }
      return tx.retiroGanancias.create({
        data: {
          negocioId,
          monto: balance.disponible,
          estado: RETIRO_SOLICITADO,
        },
        select: { id: true, monto: true, estado: true, createdAt: true },
      });
    });
    return {
      id: retiro.id,
      monto: money(retiro.monto),
      estado: retiro.estado,
      fecha: retiro.createdAt,
    };
  }

  private async calcularBalances(db: Db, negocioIds: string[]) {
    const [porEvento, retiros] = await Promise.all([
      db.venta.groupBy({
        by: ['negocioId', 'eventoId'],
        where: { negocioId: { in: negocioIds } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      db.retiroGanancias.groupBy({
        by: ['negocioId'],
        where: {
          negocioId: { in: negocioIds },
          estado: { not: RETIRO_RECHAZADO },
        },
        _sum: { monto: true },
      }),
    ]);
    const eventos = await db.evento.findMany({
      where: { id: { in: [...new Set(porEvento.map((p) => p.eventoId))] } },
      select: {
        id: true,
        titulo: true,
        estado: true,
        fechas: { select: { fecha: true } },
      },
    });
    const today = todayIn(this.timeZone);
    const info = new Map(
      eventos.map((e) => {
        const fechaFin =
          e.fechas
            .map((f) => dateToDay(f.fecha))
            .sort()
            .pop() ?? null;
        const cerrado =
          ESTADOS_CERRADOS.includes(e.estado) ||
          (fechaFin !== null && fechaFin < today);
        return [e.id, { titulo: e.titulo, fechaFin, cerrado }];
      }),
    );

    return new Map(
      negocioIds.map((id) => {
        let acreditado = new Prisma.Decimal(0);
        let pendiente = new Prisma.Decimal(0);
        const detalle = porEvento
          .filter((p) => p.negocioId === id)
          .map((p) => {
            const ev = info.get(p.eventoId);
            const total = p._sum.total ?? new Prisma.Decimal(0);
            if (ev?.cerrado) acreditado = acreditado.add(total);
            else pendiente = pendiente.add(total);
            return {
              eventoId: p.eventoId,
              titulo: ev?.titulo ?? 'Evento',
              fechaFin: ev?.fechaFin ?? null,
              cerrado: Boolean(ev?.cerrado),
              total: money(total),
              transacciones: p._count._all,
            };
          });
        const retirado =
          retiros.find((r) => r.negocioId === id)?._sum.monto ??
          new Prisma.Decimal(0);
        return [
          id,
          {
            acreditado,
            pendiente,
            retirado,
            disponible: acreditado.sub(retirado),
            eventos: detalle,
          },
        ];
      }),
    );
  }

  private async resolveNegocios(duenoId: string, negocioId?: string) {
    const negocios = await this.prisma.negocio.findMany({
      where: { duenoId },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    if (negocioId && !negocios.some((n) => n.id === negocioId)) {
      throw new ForbiddenException('No eres dueño de este negocio.');
    }
    return {
      negocios,
      ids: negocioId ? [negocioId] : negocios.map((n) => n.id),
    };
  }

  /** Eventos donde participan los negocios (aceptados o con ventas registradas), para los filtros. */
  private async eventosDeNegocios(ids: string[]) {
    if (!ids.length) return [];
    const [aceptados, conVentas] = await Promise.all([
      findEventosAceptados(this.prisma, ids),
      this.prisma.venta.groupBy({
        by: ['eventoId'],
        where: { negocioId: { in: ids } },
      }),
    ]);
    return this.prisma.evento.findMany({
      where: {
        id: {
          in: [...new Set([...aceptados, ...conVentas.map((v) => v.eventoId)])],
        },
      },
      select: { id: true, titulo: true },
      orderBy: { titulo: 'asc' },
    });
  }

  private ventasWhere(
    negocioIds: string[],
    eventoId: string | undefined,
    range: { gte: Date; lt: Date },
  ) {
    return {
      negocioId: { in: negocioIds },
      ...(eventoId ? { eventoId } : {}),
      createdAt: { gte: range.gte, lt: range.lt },
    } satisfies Prisma.VentaWhereInput;
  }

  private diasDelRango(desde: string, hasta: string) {
    const dias: string[] = [];
    for (
      let t = dayToDate(desde).getTime();
      t <= dayToDate(hasta).getTime();
      t += DAY_MS
    ) {
      dias.push(new Date(t).toISOString().slice(0, 10));
    }
    return dias;
  }

  private toVentaRow(v: VentaRow, nombres: NombresVentas) {
    return {
      id: v.id,
      fecha: v.createdAt,
      negocio: nombres.negocio(v),
      evento: nombres.evento(v),
      cliente: nombres.cliente(v),
      ayudante: nombres.ayudante(v),
      productos: nombres.productos(v),
      total: money(v.total),
    };
  }
}

/**
 * Celda CSV segura. Nombres de clientes y productos los escriben los usuarios: si empiezan con
 * =, +, -, @, tab o retorno, Excel los ejecutaría como fórmula (inyección CSV). Se les antepone
 * un apóstrofo para que se muestren como texto. Los montos son números y no se tocan.
 */
export function csvCell(value: string | number) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
