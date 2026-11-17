import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EstadoIncidencia,
  EstadoTransaccion,
  Prisma,
  TipoTransaccionSaldo,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveDayRange } from '../pos/pos-dates';
import {
  codigoTransaccion,
  money,
  newId,
  nombreCompleto,
} from '../pos/pos-helpers';
import { FiltroRecargasAdminDto } from './dto/recargas.dto';
import { incidenciaDto, ULTIMA_INCIDENCIA } from './incidencias';

const PAGE_SIZE = 50;
const NOTA_MAX = 191;
const ANULACION_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const recortar = (texto: string) =>
  texto.length > NOTA_MAX ? `${texto.slice(0, NOTA_MAX - 1)}…` : texto;

/**
 * HU-047: el administrador general revisa las recargas y anula las que se hicieron por error.
 * Solo el ADMIN puede anular: el recargador no, para que nadie pueda borrar dinero que recibió.
 */
@Injectable()
export class RecargasAdminService {
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  async listar(dto: FiltroRecargasAdminDto) {
    const where: Prisma.TransaccionSaldoWhereInput = {
      tipo: TipoTransaccionSaldo.RECARGA,
      ...(dto.eventoId ? { eventoId: dto.eventoId } : {}),
      ...(dto.estado ? { estado: dto.estado } : {}),
      ...(dto.incidencia
        ? { incidencias: { some: { estado: dto.incidencia } } }
        : {}),
    };
    if (dto.desde || dto.hasta) {
      const range = resolveDayRange(this.timeZone, dto.desde, dto.hasta);
      where.createdAt = { gte: range.gte, lt: range.lt };
    }
    const page = dto.page ?? 1;
    // El total vigente suma solo recargas COMPLETADAS dentro del filtro: si se filtran las
    // anuladas, no hay nada vigente que sumar.
    const soloAnuladas = dto.estado === EstadoTransaccion.ANULADA;

    const [recargas, totalItems, completadas, incidenciasAbiertas] =
      await Promise.all([
        this.prisma.transaccionSaldo.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            createdAt: true,
            monto: true,
            saldoResultante: true,
            estado: true,
            nota: true,
            usuarioId: true,
            operadorId: true,
            eventoId: true,
            incidencias: ULTIMA_INCIDENCIA,
          },
        }),
        this.prisma.transaccionSaldo.count({ where }),
        soloAnuladas
          ? null
          : this.prisma.transaccionSaldo.aggregate({
              where: { ...where, estado: EstadoTransaccion.COMPLETADA },
              _sum: { monto: true },
            }),
        this.prisma.incidenciaRecarga.count({
          where: { estado: EstadoIncidencia.ABIERTA },
        }),
      ]);

    const usuarioIds = [
      ...new Set(
        recargas.flatMap((r) => [r.usuarioId, r.operadorId]).filter(Boolean),
      ),
    ] as string[];
    const [usuarios, eventos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { id: { in: usuarioIds } },
        select: { id: true, nombre: true, apellido: true },
      }),
      this.prisma.evento.findMany({
        where: { id: { in: [...new Set(recargas.map((r) => r.eventoId))] } },
        select: { id: true, titulo: true },
      }),
    ]);
    const nombre = new Map(usuarios.map((u) => [u.id, nombreCompleto(u)]));
    const titulo = new Map(eventos.map((e) => [e.id, e.titulo]));

    return {
      page,
      pageSize: PAGE_SIZE,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / PAGE_SIZE)),
      /** Suma de las recargas vigentes que cumplen el filtro (todas las páginas). */
      totalRecargado: money(completadas?._sum.monto),
      /** Incidencias reportadas por los recargadores que aún no se resolvieron (todas las recargas). */
      incidenciasAbiertas,
      recargas: recargas.map((r) => ({
        id: r.id,
        codigo: codigoTransaccion(r.id),
        fecha: r.createdAt,
        cliente: nombre.get(r.usuarioId) ?? 'Cliente',
        recargador: (r.operadorId && nombre.get(r.operadorId)) || '—',
        evento: titulo.get(r.eventoId) ?? 'Evento',
        monto: money(r.monto),
        saldoResultante: money(r.saldoResultante),
        estado: r.estado,
        nota: r.nota,
        incidencia: incidenciaDto(r.incidencias[0]),
      })),
    };
  }

  /** Cierra una incidencia reportada por un recargador indicando qué se hizo. */
  async resolverIncidencia(adminId: string, id: string, resolucion: string) {
    const cerrada = await this.prisma.incidenciaRecarga.updateMany({
      where: { id, estado: EstadoIncidencia.ABIERTA },
      data: {
        estado: EstadoIncidencia.RESUELTA,
        resolucion,
        resueltaPorId: adminId,
        resueltaAt: new Date(),
      },
    });
    if (!cerrada.count) {
      const existe = await this.prisma.incidenciaRecarga.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existe) throw new NotFoundException('Incidencia no encontrada');
      throw new ConflictException('Esta incidencia ya fue resuelta.');
    }
    const incidencia = await this.prisma.incidenciaRecarga.findUniqueOrThrow({
      where: { id },
      select: ULTIMA_INCIDENCIA.select,
    });
    return incidenciaDto(incidencia);
  }

  /**
   * Anula una recarga: la marca ANULADA y descuenta su monto del saldo del cliente, dejando un
   * movimiento AJUSTE negativo como rastro. Si el cliente ya gastó parte de ese saldo, no se
   * puede anular (el saldo quedaría negativo).
   *
   * El cambio de estado es condicional (`estado = COMPLETADA`): si dos administradores anulan a
   * la vez, solo uno lo consigue.
   */
  async anular(adminId: string, id: string, motivo: string) {
    const recarga = await this.prisma.transaccionSaldo.findUnique({
      where: { id },
      select: {
        id: true,
        tipo: true,
        estado: true,
        monto: true,
        nota: true,
        usuarioId: true,
        eventoId: true,
        saldoEventoId: true,
      },
    });
    if (!recarga) throw new NotFoundException('Recarga no encontrada');
    if (recarga.tipo !== TipoTransaccionSaldo.RECARGA) {
      throw new BadRequestException('Solo se pueden anular recargas.');
    }
    if (recarga.estado === EstadoTransaccion.ANULADA) {
      throw new ConflictException('Esta recarga ya fue anulada.');
    }
    if (recarga.estado !== EstadoTransaccion.COMPLETADA) {
      throw new BadRequestException(
        'Solo se pueden anular recargas completadas.',
      );
    }

    const codigo = codigoTransaccion(recarga.id);
    const ajusteId = newId();
    const fecha = new Date();

    const saldoResultante = await this.prisma.$transaction(async (tx) => {
      const marcada = await tx.transaccionSaldo.updateMany({
        where: { id, estado: EstadoTransaccion.COMPLETADA },
        data: {
          estado: EstadoTransaccion.ANULADA,
          nota: recortar(`${recarga.nota ?? 'Recarga'} · Anulada: ${motivo}`),
        },
      });
      if (!marcada.count) {
        throw new ConflictException('Esta recarga ya fue anulada.');
      }

      const descontado = await tx.saldoEvento.updateMany({
        where: { id: recarga.saldoEventoId, saldo: { gte: recarga.monto } },
        data: { saldo: { decrement: recarga.monto } },
      });
      if (!descontado.count) {
        const actual = await tx.saldoEvento.findUnique({
          where: { id: recarga.saldoEventoId },
          select: { saldo: true },
        });
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'SALDO_YA_USADO',
          message: `El cliente ya usó parte de este saldo: tiene Bs ${money(actual?.saldo)} y la recarga fue de Bs ${money(recarga.monto)}. No se puede anular.`,
          saldo: money(actual?.saldo),
          monto: money(recarga.monto),
        });
      }

      const saldo = await tx.saldoEvento.findUniqueOrThrow({
        where: { id: recarga.saldoEventoId },
        select: { saldo: true },
      });
      await tx.transaccionSaldo.createMany({
        data: [
          {
            id: ajusteId,
            saldoEventoId: recarga.saldoEventoId,
            usuarioId: recarga.usuarioId,
            eventoId: recarga.eventoId,
            operadorId: adminId,
            tipo: TipoTransaccionSaldo.AJUSTE,
            monto: recarga.monto.neg(),
            saldoResultante: saldo.saldo,
            estado: EstadoTransaccion.COMPLETADA,
            nota: recortar(`Anulación de la recarga ${codigo}: ${motivo}`),
            createdAt: fecha,
          },
        ],
      });
      await tx.incidenciaRecarga.updateMany({
        where: { transaccionId: id, estado: EstadoIncidencia.ABIERTA },
        data: {
          estado: EstadoIncidencia.RESUELTA,
          resolucion: `Recarga anulada: ${motivo}`,
          resueltaPorId: adminId,
          resueltaAt: fecha,
        },
      });
      return saldo.saldo;
    }, ANULACION_TX_OPTIONS);

    return {
      id: recarga.id,
      codigo,
      estado: EstadoTransaccion.ANULADA,
      montoRevertido: money(recarga.monto),
      saldoResultante: money(saldoResultante),
      ajuste: { id: ajusteId, codigo: codigoTransaccion(ajusteId) },
    };
  }
}
