import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
import { dateToDay, todayIn } from '../events/event-schedule';
import {
  codigoTransaccion,
  money,
  newId,
  nombreCompleto,
} from '../pos/pos-helpers';
import { CodigoClienteService } from '../saldo/codigo-cliente.service';
import { fotoPrimerIngreso } from '../saldo/foto-ingreso';
import { plazoRetiroEvento, type PlazoRetiro } from '../saldo/plazo-retiro';
import { estadoTemporal } from '../saldo/saldo-helpers';
import {
  ConsultaClienteDevolucionDto,
  CreateDevolucionDto,
} from './dto/devoluciones.dto';

/** Estados en los que el evento ya ocurrió o está ocurriendo y puede tener saldo por devolver. */
const EVENTO_CON_SALDO: EventoEstado[] = [
  EventoEstado.PUBLICADO,
  EventoEstado.FINALIZADO,
  EventoEstado.CANCELADO,
];

const NOTA_DEVOLUCION = 'Devolución en efectivo';

/** La base es remota: se da margen a la transacción antes de abortarla. */
const DEVOLUCION_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const FECHAS_SELECT = {
  select: { fecha: true, horaInicio: true, horaFin: true },
  orderBy: { fecha: 'asc' },
} satisfies Prisma.Evento$fechasArgs;

function isUniqueViolation(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

function plazoDto(plazo: PlazoRetiro | null) {
  return plazo
    ? {
        fechaLimite: plazo.fechaLimite,
        vencido: plazo.vencido,
        diasRestantes: plazo.diasRestantes,
      }
    : null;
}

/**
 * Módulo A (Sprint 3): el encargado de devoluciones asignado al evento escanea la manilla o el QR
 * del cliente (HU-026), ve el saldo que le queda en ese evento (HU-027) y se lo entrega en
 * efectivo, dejando el saldo en cero (HU-028).
 *
 * Se puede devolver durante el evento y hasta `PLAZO_RETIRO_DIAS` después de que termina; vencido
 * el plazo, el saldo deja de estar disponible (se calcula al consultar, no se escribe nada).
 */
@Injectable()
export class DevolucionesService {
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
    private codigoCliente: CodigoClienteService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  /** Eventos donde el usuario está asignado a devoluciones, con su plazo; los vigentes primero. */
  async contexto(usuarioId: string) {
    const asignaciones = await this.prisma.staffEvento.findMany({
      where: {
        usuarioId,
        role: Role.DEVOLUCIONES,
        activo: true,
        evento: { estado: { in: EVENTO_CON_SALDO } },
      },
      select: {
        evento: {
          select: {
            id: true,
            titulo: true,
            estado: true,
            fechas: FECHAS_SELECT,
          },
        },
      },
    });

    const today = todayIn(this.timeZone);
    const now = new Date();
    return {
      hoy: today,
      eventos: asignaciones
        .map(({ evento: e }) => {
          const dias = e.fechas.map((f) => dateToDay(f.fecha));
          const plazo = plazoRetiroEvento(e.fechas, this.timeZone, now);
          return {
            id: e.id,
            titulo: e.titulo,
            fechaInicio: dias[0] ?? null,
            fechaFin: dias[dias.length - 1] ?? null,
            momento:
              e.estado === EventoEstado.PUBLICADO
                ? estadoTemporal(e.fechas, today, this.timeZone, now)
                : ('FINALIZADO' as const),
            cancelado: e.estado === EventoEstado.CANCELADO,
            plazo: plazoDto(plazo),
            /** Se pueden hacer devoluciones ahora (el plazo no venció). */
            disponible: !!plazo && !plazo.vencido,
          };
        })
        .sort(
          (a, b) =>
            Number(b.disponible) - Number(a.disponible) ||
            (b.fechaFin ?? '').localeCompare(a.fechaFin ?? ''),
        ),
    };
  }

  /**
   * HU-026 / HU-027: identifica al cliente y muestra el saldo que puede retirar en este evento,
   * con la foto de su primer ingreso para confirmar que es la misma persona. Si el plazo venció,
   * igual se muestra el saldo pero no se puede devolver.
   */
  async consultarCliente(
    encargadoId: string,
    dto: ConsultaClienteDevolucionDto,
  ) {
    const [evento, cliente] = await Promise.all([
      this.requireEventoAsignado(encargadoId, dto.eventoId),
      this.codigoCliente.resolver(dto.eventoId, dto.codigo),
    ]);
    const [saldo, usuario, fotoIngreso, ultimaDevolucion] = await Promise.all([
      this.saldoDe(cliente.usuarioId, dto.eventoId),
      this.prisma.usuario.findUnique({
        where: { id: cliente.usuarioId },
        select: { documento: true },
      }),
      fotoPrimerIngreso(
        this.prisma,
        cliente.usuarioId,
        dto.eventoId,
        cliente.entradaId,
      ),
      this.prisma.transaccionSaldo.findFirst({
        where: {
          usuarioId: cliente.usuarioId,
          eventoId: dto.eventoId,
          tipo: TipoTransaccionSaldo.DEVOLUCION,
          estado: EstadoTransaccion.COMPLETADA,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, monto: true, createdAt: true },
      }),
    ]);

    const vencido = evento.plazo.vencido;
    const conSaldo = saldo.gt(0);
    return {
      evento: { id: evento.id, titulo: evento.titulo },
      cliente: {
        nombre: cliente.nombre,
        documento: usuario?.documento ?? null,
        medio: cliente.medio,
        identificador: cliente.identificador,
        categoria: cliente.categoria,
      },
      /** Foto del primer ingreso (HU-046); null si la persona nunca pasó por el control de acceso. */
      fotoIngreso,
      saldo: money(saldo),
      /** Lo que se le puede entregar ahora: todo el saldo, salvo que el plazo haya vencido. */
      montoDevolvible: money(vencido ? 0 : saldo),
      plazo: plazoDto(evento.plazo),
      puedeDevolver: !vencido && conSaldo,
      motivo: vencido
        ? `El plazo para retirar el saldo venció el ${evento.plazo.fechaLimite}.`
        : conSaldo
          ? null
          : 'El cliente no tiene saldo para devolver en este evento.',
      ultimaDevolucion: ultimaDevolucion
        ? {
            codigo: codigoTransaccion(ultimaDevolucion.id),
            fecha: ultimaDevolucion.createdAt,
            monto: money(ultimaDevolucion.monto),
          }
        : null,
    };
  }

  /**
   * HU-028: entrega en efectivo todo el saldo del cliente en el evento y lo deja en cero.
   *
   * El saldo solo se pone en cero si sigue siendo el monto que vio el encargado (`montoEsperado`):
   * la operación es atómica, así dos devoluciones simultáneas nunca pagan dos veces y una compra
   * de último momento no hace que se entregue más de lo que se descuenta.
   *
   * Idempotencia: la `idempotencyKey` se usa como id de la transacción; si el terminal reintenta
   * una devolución que ya se registró, se devuelve ese resultado en lugar de fallar.
   */
  async devolver(encargadoId: string, dto: CreateDevolucionDto) {
    const transaccionId = dto.idempotencyKey ?? newId();
    if (dto.idempotencyKey) {
      const previo = await this.devolucionRegistrada(
        transaccionId,
        encargadoId,
      );
      if (previo) return previo;
    }

    const [evento, cliente] = await Promise.all([
      this.requireEventoAsignado(encargadoId, dto.eventoId),
      this.codigoCliente.resolver(dto.eventoId, dto.codigo),
    ]);
    if (evento.plazo.vencido) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'PLAZO_VENCIDO',
        message: `El plazo para retirar el saldo de este evento venció el ${evento.plazo.fechaLimite}.`,
      });
    }

    const monto = new Prisma.Decimal(dto.montoEsperado);
    const fecha = new Date();
    try {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.saldoEvento.updateMany({
          where: {
            usuarioId: cliente.usuarioId,
            eventoId: dto.eventoId,
            saldo: monto,
          },
          data: { saldo: 0 },
        });
        if (!count) {
          const actual = await tx.saldoEvento.findUnique({
            where: {
              usuarioId_eventoId: {
                usuarioId: cliente.usuarioId,
                eventoId: dto.eventoId,
              },
            },
            select: { saldo: true },
          });
          throw this.saldoCambio(actual?.saldo ?? new Prisma.Decimal(0));
        }

        const saldo = await tx.saldoEvento.findUniqueOrThrow({
          where: {
            usuarioId_eventoId: {
              usuarioId: cliente.usuarioId,
              eventoId: dto.eventoId,
            },
          },
          select: { id: true },
        });
        await tx.transaccionSaldo.createMany({
          data: [
            {
              id: transaccionId,
              saldoEventoId: saldo.id,
              usuarioId: cliente.usuarioId,
              eventoId: dto.eventoId,
              operadorId: encargadoId,
              tipo: TipoTransaccionSaldo.DEVOLUCION,
              monto,
              saldoResultante: 0,
              estado: EstadoTransaccion.COMPLETADA,
              nota: NOTA_DEVOLUCION,
              createdAt: fecha,
            },
          ],
        });
      }, DEVOLUCION_TX_OPTIONS);
    } catch (err) {
      // Dos envíos simultáneos con la misma clave: el segundo choca con la transacción del primero
      // (id repetido) o encuentra el saldo ya en cero (409). En ambos casos ya se devolvió.
      if (
        dto.idempotencyKey &&
        (isUniqueViolation(err) || err instanceof ConflictException)
      ) {
        const previo = await this.devolucionRegistrada(
          transaccionId,
          encargadoId,
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
      evento: evento.titulo,
      cliente: {
        nombre: cliente.nombre,
        medio: cliente.medio,
        identificador: cliente.identificador,
      },
      monto: money(monto),
      saldoAnterior: money(monto),
      saldoResultante: money(0),
    };
  }

  /**
   * Resultado de una devolución ya registrada con esta clave (reintento del terminal), o null si
   * no existe. Si la clave pertenece a otra operación u otro encargado, se rechaza.
   */
  private async devolucionRegistrada(
    transaccionId: string,
    encargadoId: string,
  ) {
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
        createdAt: true,
      },
    });
    if (!tx) return null;
    if (
      tx.tipo !== TipoTransaccionSaldo.DEVOLUCION ||
      tx.operadorId !== encargadoId
    ) {
      throw new ConflictException(
        'La clave de esta devolución ya fue utilizada.',
      );
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
      evento: evento?.titulo ?? 'Evento',
      cliente: {
        nombre: nombreCompleto(usuario) ?? 'Cliente',
        medio: null,
        identificador: null,
      },
      monto: money(tx.monto),
      saldoAnterior: money(tx.monto),
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
   * El usuario debe estar asignado a devoluciones en el evento, y el evento debe estar publicado,
   * finalizado o cancelado y tener fechas (de ellas sale el plazo de retiro).
   */
  private async requireEventoAsignado(usuarioId: string, eventoId: string) {
    const [asignacion, evento] = await Promise.all([
      this.prisma.staffEvento.findFirst({
        where: { usuarioId, eventoId, role: Role.DEVOLUCIONES, activo: true },
        select: { id: true },
      }),
      this.prisma.evento.findFirst({
        where: { id: eventoId, estado: { in: EVENTO_CON_SALDO } },
        select: { id: true, titulo: true, fechas: FECHAS_SELECT },
      }),
    ]);
    if (!asignacion) {
      throw new ForbiddenException(
        'No estás asignado a devoluciones en este evento.',
      );
    }
    if (!evento) throw new NotFoundException('Evento no encontrado');
    const plazo = plazoRetiroEvento(evento.fechas, this.timeZone);
    if (!plazo) {
      throw new BadRequestException('El evento no tiene fechas programadas.');
    }
    return { id: evento.id, titulo: evento.titulo, plazo };
  }

  private saldoCambio(saldo: Prisma.Decimal) {
    if (saldo.lte(0)) {
      return new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'SIN_SALDO',
        message:
          'El cliente ya no tiene saldo para devolver en este evento (puede que ya se le haya devuelto).',
        saldo: money(saldo),
      });
    }
    return new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'SALDO_CAMBIO',
      message: `El saldo del cliente cambió: ahora tiene Bs ${money(saldo)}. Revisa el monto antes de devolver.`,
      saldo: money(saldo),
    });
  }
}
