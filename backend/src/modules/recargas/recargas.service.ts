import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EstadoTransaccion,
  EventoEstado,
  Prisma,
  Role,
  TipoTransaccionSaldo,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dateToDay, dayToDate, todayIn } from '../events/event-schedule';
import { horarioActual, resolveDayRange } from '../pos/pos-dates';
import {
  codigoTransaccion,
  money,
  newId,
  nombreCompleto,
} from '../pos/pos-helpers';
import { CodigoClienteService } from '../saldo/codigo-cliente.service';
import {
  ConsultaClienteRecargaDto,
  CreateRecargaDto,
  HistorialRecargasDto,
} from './dto/recargas.dto';
import {
  METODOS_PAGO,
  MONTOS_RAPIDOS,
  NOTA_METODO,
  RECARGA_MAX,
  RECARGA_MIN,
  SALDO_MAX_EVENTO,
} from './recargas.constants';

/** Máximo de recargas que se devuelven en el historial del recargador (los totales cubren todo el rango). */
const HISTORIAL_LIMIT = 500;

/** La base es remota: se da margen a la transacción de la recarga antes de abortarla. */
const RECARGA_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const DAY_MS = 24 * 60 * 60 * 1000;

function isUniqueViolation(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

/**
 * HU-019 / HU-047: el recargador asignado al evento escanea el QR o la manilla del cliente y
 * acredita 1:1 el dinero recibido en efectivo como saldo del cliente en ese evento.
 *
 * Igual que el cobro del POS, las validaciones independientes se hacen en paralelo porque la
 * base es remota y cada consulta cuesta un viaje de red.
 */
@Injectable()
export class RecargasService {
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
    private codigoCliente: CodigoClienteService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  /** Eventos donde el usuario está asignado como recargador, límites y montos rápidos. */
  async contexto(usuarioId: string) {
    const asignaciones = await this.prisma.staffEvento.findMany({
      where: {
        usuarioId,
        role: Role.RECARGADOR,
        activo: true,
        evento: { estado: EventoEstado.PUBLICADO },
      },
      select: {
        evento: {
          select: {
            id: true,
            titulo: true,
            fechas: {
              select: { fecha: true, horaInicio: true, horaFin: true },
              orderBy: { fecha: 'asc' },
            },
          },
        },
      },
    });

    return {
      hoy: todayIn(this.timeZone),
      limites: {
        minimo: money(RECARGA_MIN),
        maximo: money(RECARGA_MAX),
        saldoMaximo: money(SALDO_MAX_EVENTO),
      },
      montosRapidos: MONTOS_RAPIDOS.map((m) => money(m)),
      metodosPago: [...METODOS_PAGO],
      eventos: asignaciones
        .map(({ evento: e }) => {
          const dias = e.fechas.map((f) => dateToDay(f.fecha));
          const { abierto, horarioHoy } = horarioActual(
            e.fechas,
            this.timeZone,
          );
          return {
            id: e.id,
            titulo: e.titulo,
            fechaInicio: dias[0] ?? null,
            fechaFin: dias[dias.length - 1] ?? null,
            /** Abierto ahora: es día del evento y está dentro de su horario. */
            enCurso: abierto,
            /** Horario de hoy ("18:00 – 23:00") o null si hoy no es día del evento. */
            horarioHoy,
          };
        })
        .sort(
          (a, b) =>
            Number(b.enCurso) - Number(a.enCurso) ||
            (a.fechaInicio ?? '').localeCompare(b.fechaInicio ?? ''),
        ),
    };
  }

  /** Datos del cliente y su saldo en el evento, antes de elegir el monto. */
  async consultarCliente(usuarioId: string, dto: ConsultaClienteRecargaDto) {
    const [, cliente] = await Promise.all([
      this.requireEventoAsignado(usuarioId, dto.eventoId),
      this.codigoCliente.resolver(dto.eventoId, dto.codigo),
    ]);
    const saldoActual = await this.saldoDe(cliente.usuarioId, dto.eventoId);
    const disponible = new Prisma.Decimal(SALDO_MAX_EVENTO).sub(saldoActual);
    const maxRecargable = Prisma.Decimal.max(
      0,
      Prisma.Decimal.min(RECARGA_MAX, disponible),
    );
    return {
      cliente: {
        nombre: cliente.nombre,
        medio: cliente.medio,
        identificador: cliente.identificador,
        categoria: cliente.categoria,
      },
      saldo: money(saldoActual),
      /** Lo máximo que se le puede recargar ahora sin pasar el saldo máximo del evento. */
      maxRecargable: money(maxRecargable),
    };
  }

  /**
   * Acredita la recarga. El aumento es condicional (`saldo + monto <= saldo máximo`) y atómico,
   * así dos recargas simultáneas nunca superan el tope. Si el cliente aún no tiene saldo en el
   * evento, se crea con 0 antes de sumar.
   *
   * Idempotencia (HU-047): la `idempotencyKey` se usa como id de la transacción. Si el terminal
   * reintenta una recarga que ya se registró (se perdió la respuesta), se devuelve ese resultado
   * en lugar de acreditar otra vez.
   */
  async recargar(recargadorId: string, dto: CreateRecargaDto) {
    const transaccionId = dto.idempotencyKey ?? newId();
    if (dto.idempotencyKey) {
      const previo = await this.recargaRegistrada(transaccionId, recargadorId);
      if (previo) return previo;
    }

    const [evento, cliente] = await Promise.all([
      this.requireEventoAsignado(recargadorId, dto.eventoId),
      this.codigoCliente.resolver(dto.eventoId, dto.codigo),
    ]);

    const monto = new Prisma.Decimal(dto.monto);
    const tope = new Prisma.Decimal(SALDO_MAX_EVENTO).sub(monto);
    const metodoPago = dto.metodoPago ?? 'EFECTIVO';
    const fecha = new Date();
    const saldoKey = {
      usuarioId_eventoId: {
        usuarioId: cliente.usuarioId,
        eventoId: dto.eventoId,
      },
    };

    let saldoResultante: Prisma.Decimal;
    try {
      saldoResultante = await this.prisma.$transaction(async (tx) => {
        // Primera recarga del cliente en este evento: se crea su saldo (si ya existe, no hace nada).
        await tx.saldoEvento.createMany({
          data: [
            {
              id: newId(),
              usuarioId: cliente.usuarioId,
              eventoId: dto.eventoId,
              saldo: 0,
            },
          ],
          skipDuplicates: true,
        });
        const { count } = await tx.saldoEvento.updateMany({
          where: {
            usuarioId: cliente.usuarioId,
            eventoId: dto.eventoId,
            saldo: { lte: tope },
          },
          data: { saldo: { increment: monto } },
        });
        if (!count) {
          const actual = await tx.saldoEvento.findUnique({
            where: saldoKey,
            select: { saldo: true },
          });
          throw this.saldoMaximoSuperado(
            actual?.saldo ?? new Prisma.Decimal(0),
          );
        }

        const saldo = await tx.saldoEvento.findUniqueOrThrow({
          where: saldoKey,
          select: { id: true, saldo: true },
        });
        await tx.transaccionSaldo.createMany({
          data: [
            {
              id: transaccionId,
              saldoEventoId: saldo.id,
              usuarioId: cliente.usuarioId,
              eventoId: dto.eventoId,
              operadorId: recargadorId,
              tipo: TipoTransaccionSaldo.RECARGA,
              monto,
              saldoResultante: saldo.saldo,
              estado: EstadoTransaccion.COMPLETADA,
              nota: NOTA_METODO[metodoPago],
              createdAt: fecha,
            },
          ],
        });
        return saldo.saldo;
      }, RECARGA_TX_OPTIONS);
    } catch (err) {
      // Dos envíos simultáneos con la misma clave: el segundo choca con la transacción del primero.
      if (dto.idempotencyKey && isUniqueViolation(err)) {
        const previo = await this.recargaRegistrada(
          transaccionId,
          recargadorId,
        );
        if (previo) return previo;
      }
      throw err;
    }

    return {
      transaccionId,
      codigo: codigoTransaccion(transaccionId),
      fecha,
      repetido: false,
      estado: EstadoTransaccion.COMPLETADA,
      metodoPago,
      evento: evento.titulo,
      cliente: {
        nombre: cliente.nombre,
        medio: cliente.medio,
        identificador: cliente.identificador,
      },
      monto: money(monto),
      saldoAnterior: money(saldoResultante.sub(monto)),
      saldoResultante: money(saldoResultante),
    };
  }

  /** HU-020: recargas hechas por el recargador en un día o rango de días (por defecto, hoy). */
  async misRecargas(recargadorId: string, dto: HistorialRecargasDto) {
    const range = resolveDayRange(this.timeZone, dto.desde, dto.hasta);
    const where: Prisma.TransaccionSaldoWhereInput = {
      operadorId: recargadorId,
      tipo: TipoTransaccionSaldo.RECARGA,
      createdAt: { gte: range.gte, lt: range.lt },
      ...(dto.eventoId ? { eventoId: dto.eventoId } : {}),
    };

    const [recargas, completadas, anuladas] = await Promise.all([
      this.prisma.transaccionSaldo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: HISTORIAL_LIMIT,
        select: {
          id: true,
          createdAt: true,
          monto: true,
          saldoResultante: true,
          estado: true,
          usuarioId: true,
          eventoId: true,
        },
      }),
      this.prisma.transaccionSaldo.aggregate({
        where: { ...where, estado: EstadoTransaccion.COMPLETADA },
        _sum: { monto: true },
        _count: { _all: true },
      }),
      this.prisma.transaccionSaldo.count({
        where: { ...where, estado: EstadoTransaccion.ANULADA },
      }),
    ]);

    const [usuarios, eventos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { id: { in: [...new Set(recargas.map((r) => r.usuarioId))] } },
        select: { id: true, nombre: true, apellido: true },
      }),
      this.prisma.evento.findMany({
        where: { id: { in: [...new Set(recargas.map((r) => r.eventoId))] } },
        select: { id: true, titulo: true },
      }),
    ]);
    const cliente = new Map(usuarios.map((u) => [u.id, nombreCompleto(u)]));
    const titulo = new Map(eventos.map((e) => [e.id, e.titulo]));

    return {
      desde: range.desde,
      hasta: range.hasta,
      /** Total cobrado en efectivo: solo recargas vigentes (las anuladas no cuentan). */
      total: money(completadas._sum.monto),
      cantidad: completadas._count._all,
      anuladas,
      recargas: recargas.map((r) => ({
        id: r.id,
        codigo: codigoTransaccion(r.id),
        fecha: r.createdAt,
        cliente: cliente.get(r.usuarioId) ?? 'Cliente',
        evento: titulo.get(r.eventoId) ?? 'Evento',
        monto: money(r.monto),
        saldoResultante: money(r.saldoResultante),
        estado: r.estado,
      })),
    };
  }

  /**
   * Resultado de una recarga ya registrada con esta clave (reintento del terminal), o null si no
   * existe. Si la clave pertenece a otra operación u otro recargador, se rechaza.
   */
  private async recargaRegistrada(transaccionId: string, recargadorId: string) {
    const tx = await this.prisma.transaccionSaldo.findUnique({
      where: { id: transaccionId },
      select: {
        id: true,
        tipo: true,
        operadorId: true,
        usuarioId: true,
        eventoId: true,
        monto: true,
        saldoResultante: true,
        estado: true,
        nota: true,
        createdAt: true,
      },
    });
    if (!tx) return null;
    if (
      tx.tipo !== TipoTransaccionSaldo.RECARGA ||
      tx.operadorId !== recargadorId
    ) {
      throw new ConflictException('La clave de esta recarga ya fue utilizada.');
    }
    const [usuario, evento] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: tx.usuarioId },
        select: { nombre: true, apellido: true },
      }),
      this.prisma.evento.findUnique({
        where: { id: tx.eventoId },
        select: { titulo: true },
      }),
    ]);
    return {
      transaccionId: tx.id,
      codigo: codigoTransaccion(tx.id),
      fecha: tx.createdAt,
      repetido: true,
      estado: tx.estado,
      metodoPago: 'EFECTIVO',
      evento: evento?.titulo ?? 'Evento',
      cliente: {
        nombre: nombreCompleto(usuario) ?? 'Cliente',
        medio: null,
        identificador: null,
      },
      monto: money(tx.monto),
      saldoAnterior: money(tx.saldoResultante.sub(tx.monto)),
      saldoResultante: money(tx.saldoResultante),
    };
  }

  private async saldoDe(usuarioId: string, eventoId: string) {
    const saldo = await this.prisma.saldoEvento.findUnique({
      where: { usuarioId_eventoId: { usuarioId, eventoId } },
      select: { saldo: true },
    });
    return saldo?.saldo ?? new Prisma.Decimal(0);
  }

  /**
   * El usuario debe estar asignado como recargador al evento, y el evento debe realizarse hoy y
   * estar dentro de su horario (ver `horarioActual`: admite horarios que cruzan la medianoche).
   */
  private async requireEventoAsignado(usuarioId: string, eventoId: string) {
    const today = dayToDate(todayIn(this.timeZone));
    const yesterday = new Date(today.getTime() - DAY_MS);
    const [asignacion, evento] = await Promise.all([
      this.prisma.staffEvento.findFirst({
        where: { usuarioId, eventoId, role: Role.RECARGADOR, activo: true },
        select: { id: true },
      }),
      this.prisma.evento.findFirst({
        where: { id: eventoId, estado: EventoEstado.PUBLICADO },
        select: {
          id: true,
          titulo: true,
          fechas: {
            where: { fecha: { in: [today, yesterday] } },
            select: { fecha: true, horaInicio: true, horaFin: true },
          },
        },
      }),
    ]);
    if (!asignacion) {
      throw new ForbiddenException(
        'No estás asignado como recargador en este evento.',
      );
    }
    if (!evento?.fechas.length) {
      throw new BadRequestException(
        'Solo se puede recargar durante los días del evento.',
      );
    }
    const { abierto, horarioHoy } = horarioActual(evento.fechas, this.timeZone);
    if (!abierto) {
      throw new BadRequestException(
        horarioHoy
          ? `El evento está cerrado en este momento. Horario de hoy: ${horarioHoy}.`
          : 'Solo se puede recargar durante el horario del evento.',
      );
    }
    return { id: evento.id, titulo: evento.titulo };
  }

  private saldoMaximoSuperado(saldo: Prisma.Decimal) {
    const disponible = Prisma.Decimal.max(
      0,
      new Prisma.Decimal(SALDO_MAX_EVENTO).sub(saldo),
    );
    return new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'SALDO_MAXIMO',
      message: `El saldo máximo por evento es Bs ${money(SALDO_MAX_EVENTO)}. El cliente tiene Bs ${money(saldo)} y solo se le pueden recargar Bs ${money(disponible)}.`,
      saldo: money(saldo),
      maxRecargable: money(disponible),
    });
  }
}
