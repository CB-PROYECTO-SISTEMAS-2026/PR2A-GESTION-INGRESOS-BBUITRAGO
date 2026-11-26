import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { money } from '../pos/pos-helpers';
import { plazoRetiroEvento } from '../saldo/plazo-retiro';
import { Prisma } from '@prisma/client';

/** Puestos que se muestran en cada ranking de clientes. */
const TOP_CLIENTES = 10;

@Injectable()
export class ReportesService {
  constructor(
    private db: PrismaService,
    private config: ConfigService,
  ) {}

  async evento(user: AuthUser, id: string) {
    const evento = await this.db.evento.findFirst({
      where: {
        id,
        ...(user.roles.includes('ADMIN') ? {} : { organizadorId: user.id }),
      },
      select: { id: true, titulo: true },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado.');
    return evento;
  }

  /**
   * HU-035: los clientes con más monto en recargas o devoluciones completadas. Sin `eventoId`
   * se suman todos los eventos.
   */
  private topClientes(tipo: 'RECARGA' | 'DEVOLUCION', eventoId?: string) {
    return this.db.transaccionSaldo.groupBy({
      by: ['usuarioId'],
      where: { tipo, estado: 'COMPLETADA', ...(eventoId ? { eventoId } : {}) },
      _sum: { monto: true },
      _count: { _all: true },
      orderBy: [{ _sum: { monto: 'desc' } }, { usuarioId: 'asc' }],
      take: TOP_CLIENTES,
    });
  }

  /** `incluirClientes` agrega los rankings con nombres de clientes, solo para el administrador. */
  async resumen(eventoId?: string, incluirClientes = false) {
    const filtro = eventoId ? { eventoId } : {};
    const [
      ventas,
      entradas,
      reembolsos,
      movimientos,
      accesos,
      porIngresar,
      operadores,
      saldos,
      eventos,
    ] = await this.db.$transaction(
      async (tx) =>
        Promise.all([
          tx.venta.aggregate({
            where: filtro,
            _sum: { total: true },
            _count: true,
          }),
          tx.compraEntrada.aggregate({
            where: { ...filtro, estado: 'APROBADA' },
            _sum: { montoTotal: true },
            _count: true,
          }),
          tx.reembolsoEntrada.aggregate({
            where: { entrada: filtro, estado: { in: ['APROBADO', 'PAGADO'] } },
            _sum: { monto: true },
          }),
          tx.transaccionSaldo.groupBy({
            by: ['tipo'],
            where: { ...filtro, estado: 'COMPLETADA' },
            _sum: { monto: true },
            _count: true,
          }),
          tx.accesoEvento.groupBy({
            by: ['tipo'],
            where: filtro,
            _count: true,
          }),
          tx.entrada.count({
            where: {
              ...filtro,
              estado: { in: ['GENERADA', 'ASIGNADA'] },
              accesos: { none: { tipo: 'INGRESO' } },
            },
          }),
          tx.transaccionSaldo.groupBy({
            by: ['tipo', 'operadorId'],
            where: {
              ...filtro,
              estado: 'COMPLETADA',
              tipo: { in: ['RECARGA', 'DEVOLUCION'] },
              operadorId: { not: null },
            },
            _sum: { monto: true },
            _count: true,
            orderBy: { _sum: { monto: 'desc' } },
          }),
          tx.saldoEvento.groupBy({
            by: ['eventoId'],
            where: { ...filtro, saldo: { gt: 0 } },
            _sum: { saldo: true },
            _count: true,
          }),
          tx.evento.findMany({
            where: { id: eventoId },
            select: {
              id: true,
              titulo: true,
              fechas: {
                select: { fecha: true, horaInicio: true, horaFin: true },
              },
            },
          }),
        ]),
      { timeout: 20000 },
    );
    const [recargan, reciben] = incluirClientes
      ? await Promise.all([
          this.topClientes('RECARGA', eventoId),
          this.topClientes('DEVOLUCION', eventoId),
        ])
      : [[], []];
    const usuarios = await this.db.usuario.findMany({
      where: {
        id: {
          in: [
            ...operadores.flatMap((o) => (o.operadorId ? [o.operadorId] : [])),
            ...[...recargan, ...reciben].map((c) => c.usuarioId),
          ],
        },
      },
      select: { id: true, nombre: true, apellido: true },
    });
    const nombres = new Map(
      usuarios.map((u) => [
        u.id,
        [u.nombre, u.apellido].filter(Boolean).join(' '),
      ]),
    );
    const saldosPorEvento = new Map(saldos.map((s) => [s.eventoId, s]));
    const ranking = (filas: typeof recargan) =>
      filas.map((c) => ({
        usuarioId: c.usuarioId,
        nombre: nombres.get(c.usuarioId) || 'Cliente',
        cantidad: c._count._all,
        total: money(c._sum.monto),
      }));
    const bruto = entradas._sum.montoTotal ?? new Prisma.Decimal(0);
    return {
      cantidadEventos: eventos.length,
      entradas: {
        compras: entradas._count,
        bruto: money(bruto),
        reembolsos: money(reembolsos._sum.monto),
        ingresoNeto: money(bruto.minus(reembolsos._sum.monto ?? 0)),
      },
      negocios: { ventas: ventas._count, total: money(ventas._sum.total) },
      movimientos: movimientos.map((m) => ({
        tipo: m.tipo,
        cantidad: m._count,
        total: money(m._sum.monto),
      })),
      accesos: {
        porIngresar,
        ...Object.fromEntries(
          ['INGRESO', 'SALIDA', 'REINGRESO'].map((tipo) => [
            tipo,
            accesos.find((a) => a.tipo === tipo)?._count ?? 0,
          ]),
        ),
      },
      operadores: operadores.map((o) => ({
        tipo: o.tipo,
        operadorId: o.operadorId,
        nombre: nombres.get(o.operadorId!),
        cantidad: o._count,
        total: money(o._sum.monto),
      })),
      ...(incluirClientes && {
        clientes: {
          recargas: ranking(recargan),
          devoluciones: ranking(reciben),
        },
      }),
      saldos: eventos
        .filter((e) => saldosPorEvento.has(e.id))
        .map((e) => {
          const saldo = saldosPorEvento.get(e.id)!;
          return {
            eventoId: e.id,
            titulo: e.titulo,
            usuarios: saldo._count,
            saldoRegistrado: money(saldo._sum.saldo),
            plazo: plazoRetiroEvento(
              e.fechas,
              this.config.get('APP_TIMEZONE', 'America/La_Paz'),
            ),
          };
        }),
    };
  }
}
