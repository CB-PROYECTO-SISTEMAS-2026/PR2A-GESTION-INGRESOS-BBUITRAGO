import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EntradaEstado,
  EventoEstado,
  Prisma,
  TipoTransaccionSaldo,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { dateToDay, dayToDate, todayIn } from '../events/event-schedule';
import {
  AYUDANTE_ACTIVO,
  findAyudanteAsignacion,
  findEventosAceptados,
} from './negocio-compat';
import { resolveDayRange } from './pos-dates';
import {
  VENTA_ROW_SELECT,
  codigoTransaccion,
  money,
  newId,
  nombreCompleto,
  nombresDeVentas,
} from './pos-helpers';
import {
  ConsultaClienteDto,
  CreateCobroDto,
  MAX_CANTIDAD_POR_PRODUCTO,
  RangoFechasDto,
} from './dto/pos.dto';

/** Máximo de ventas que se devuelven en el historial del ayudante (los totales cubren todo el rango). */
const HISTORIAL_LIMIT = 500;

/** La base es remota: se da margen a la transacción del cobro antes de abortarla. */
const COBRO_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const ENTRADA_INVALIDA: EntradaEstado[] = [
  EntradaEstado.REEMBOLSADA,
  EntradaEstado.ANULADA,
];

export interface ClienteResuelto {
  entradaId: string;
  usuarioId: string;
  nombre: string;
  /** Cómo se identificó al cliente: QR de la entrada o manilla física. */
  medio: 'QR_DIGITAL' | 'MANILLA';
  identificador: string;
  categoria: string;
}

/*
 * Las validaciones que no dependen entre sí se ejecutan en paralelo (Promise.all): con la base
 * remota cada consulta cuesta un viaje de red, y el cobro debe responder rápido en la fila.
 */
@Injectable()
export class PosService {
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  /** Negocio del ayudante, eventos donde puede vender y catálogo de productos activos. */
  async contexto(usuarioId: string) {
    const asignacion = await this.requireAyudante(usuarioId);
    const today = todayIn(this.timeZone);

    const [eventos, productos] = await Promise.all([
      findEventosAceptados(this.prisma, [asignacion.negocioId]).then((ids) =>
        this.prisma.evento.findMany({
          where: { id: { in: ids }, estado: EventoEstado.PUBLICADO },
          select: {
            id: true,
            titulo: true,
            fechas: { select: { fecha: true }, orderBy: { fecha: 'asc' } },
          },
        }),
      ),
      this.prisma.producto.findMany({
        where: { negocioId: asignacion.negocioId, activo: true },
        select: { id: true, nombre: true, precio: true, descripcion: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    return {
      negocio: { id: asignacion.negocioId, nombre: asignacion.negocioNombre },
      hoy: today,
      eventos: eventos
        .map((e) => {
          const dias = e.fechas.map((f) => dateToDay(f.fecha));
          return {
            id: e.id,
            titulo: e.titulo,
            fechaInicio: dias[0] ?? null,
            fechaFin: dias[dias.length - 1] ?? null,
            enCurso: dias.includes(today),
          };
        })
        .sort(
          (a, b) =>
            Number(b.enCurso) - Number(a.enCurso) ||
            (a.fechaInicio ?? '').localeCompare(b.fechaInicio ?? ''),
        ),
      productos: productos.map((p) => ({ ...p, precio: money(p.precio) })),
    };
  }

  /** Datos del cliente y su saldo en el evento, antes de confirmar el cobro (HU-023: validación previa). */
  async consultarCliente(usuarioId: string, dto: ConsultaClienteDto) {
    const asignacion = await this.requireAyudante(usuarioId);
    const [, cliente] = await Promise.all([
      this.requireEventoEnCurso(asignacion.negocioId, dto.eventoId),
      this.resolveCliente(dto.eventoId, dto.codigo),
    ]);
    const saldo = await this.prisma.saldoEvento.findUnique({
      where: {
        usuarioId_eventoId: {
          usuarioId: cliente.usuarioId,
          eventoId: dto.eventoId,
        },
      },
      select: { saldo: true },
    });
    return {
      cliente: {
        nombre: cliente.nombre,
        medio: cliente.medio,
        identificador: cliente.identificador,
        categoria: cliente.categoria,
      },
      saldo: money(saldo?.saldo),
    };
  }

  /**
   * HU-022 / HU-023: cobra los productos descontando el saldo del cliente en el evento.
   * El descuento es condicional (`saldo >= total`) y atómico, así dos cobros simultáneos
   * nunca dejan el saldo en negativo. Los precios siempre se toman de la base de datos.
   */
  async cobrar(ayudanteId: string, dto: CreateCobroDto) {
    const cantidades = new Map<string, number>();
    for (const item of dto.items) {
      cantidades.set(
        item.productoId,
        (cantidades.get(item.productoId) ?? 0) + item.cantidad,
      );
    }
    for (const cantidad of cantidades.values()) {
      if (cantidad > MAX_CANTIDAD_POR_PRODUCTO) {
        throw new BadRequestException(
          `La cantidad máxima por producto es ${MAX_CANTIDAD_POR_PRODUCTO}.`,
        );
      }
    }

    const asignacion = await this.requireAyudante(ayudanteId);
    const [evento, cliente, productos] = await Promise.all([
      this.requireEventoEnCurso(asignacion.negocioId, dto.eventoId),
      this.resolveCliente(dto.eventoId, dto.codigo),
      this.prisma.producto.findMany({
        where: {
          id: { in: [...cantidades.keys()] },
          negocioId: asignacion.negocioId,
          activo: true,
        },
        select: { id: true, nombre: true, precio: true },
      }),
    ]);
    if (productos.length !== cantidades.size) {
      throw new BadRequestException(
        'Algunos productos ya no están disponibles. Actualiza el catálogo.',
      );
    }

    const lineas = productos.map((p) => {
      const cantidad = cantidades.get(p.id)!;
      return {
        productoId: p.id,
        nombre: p.nombre,
        cantidad,
        precioUnit: p.precio,
        subtotal: p.precio.mul(cantidad),
      };
    });
    const total = lineas.reduce(
      (acc, l) => acc.add(l.subtotal),
      new Prisma.Decimal(0),
    );
    if (total.lte(0)) {
      throw new BadRequestException('El total del cobro debe ser mayor a 0.');
    }

    const saldoKey = {
      usuarioId_eventoId: {
        usuarioId: cliente.usuarioId,
        eventoId: dto.eventoId,
      },
    };
    const ventaId = newId();
    const transaccionId = newId();
    const fecha = new Date();

    const saldoResultante = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.saldoEvento.updateMany({
        where: {
          usuarioId: cliente.usuarioId,
          eventoId: dto.eventoId,
          saldo: { gte: total },
        },
        data: { saldo: { decrement: total } },
      });
      if (!count) {
        const actual = await tx.saldoEvento.findUnique({
          where: saldoKey,
          select: { saldo: true },
        });
        throw this.saldoInsuficiente(
          actual?.saldo ?? new Prisma.Decimal(0),
          total,
        );
      }

      const saldo = await tx.saldoEvento.findUniqueOrThrow({
        where: saldoKey,
        select: { id: true, saldo: true },
      });
      await tx.venta.createMany({
        data: [
          {
            id: ventaId,
            negocioId: asignacion.negocioId,
            eventoId: dto.eventoId,
            ayudanteId,
            clienteId: cliente.usuarioId,
            entradaId: cliente.entradaId,
            total,
            createdAt: fecha,
          },
        ],
      });
      await tx.detalleVenta.createMany({
        data: lineas.map((l) => ({
          id: newId(),
          ventaId,
          productoId: l.productoId,
          cantidad: l.cantidad,
          precioUnit: l.precioUnit,
          subtotal: l.subtotal,
        })),
      });
      await tx.transaccionSaldo.createMany({
        data: [
          {
            id: transaccionId,
            saldoEventoId: saldo.id,
            usuarioId: cliente.usuarioId,
            eventoId: dto.eventoId,
            operadorId: ayudanteId,
            tipo: TipoTransaccionSaldo.COMPRA_PRODUCTO,
            monto: total,
            saldoResultante: saldo.saldo,
            ventaId,
            nota: `Compra en ${asignacion.negocioNombre}`,
            createdAt: fecha,
          },
        ],
      });
      return saldo.saldo;
    }, COBRO_TX_OPTIONS);

    return {
      ventaId,
      transaccionId,
      codigo: codigoTransaccion(transaccionId),
      fecha,
      negocio: asignacion.negocioNombre,
      evento: evento.titulo,
      cliente: {
        nombre: cliente.nombre,
        medio: cliente.medio,
        identificador: cliente.identificador,
      },
      total: money(total),
      saldoResultante: money(saldoResultante),
      detalles: lineas.map((l) => ({
        nombre: l.nombre,
        cantidad: l.cantidad,
        precioUnit: money(l.precioUnit),
        subtotal: money(l.subtotal),
      })),
    };
  }

  /** HU-024: ventas cobradas por el ayudante en un día o rango de días (por defecto, hoy). */
  async misVentas(ayudanteId: string, dto: RangoFechasDto) {
    const range = resolveDayRange(this.timeZone, dto.desde, dto.hasta);
    const where: Prisma.VentaWhereInput = {
      ayudanteId,
      createdAt: { gte: range.gte, lt: range.lt },
    };

    const [ventas, resumen] = await Promise.all([
      this.prisma.venta.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: HISTORIAL_LIMIT,
        select: VENTA_ROW_SELECT,
      }),
      this.prisma.venta.aggregate({
        where,
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);
    const nombres = await nombresDeVentas(this.prisma, ventas);

    return {
      desde: range.desde,
      hasta: range.hasta,
      total: money(resumen._sum.total),
      cantidad: resumen._count._all,
      ventas: ventas.map((v) => ({
        id: v.id,
        fecha: v.createdAt,
        total: money(v.total),
        cliente: nombres.cliente(v),
        evento: nombres.evento(v),
        productos: nombres.productos(v),
      })),
    };
  }

  private async requireAyudante(usuarioId: string) {
    const asignacion = await findAyudanteAsignacion(this.prisma, usuarioId);
    if (!asignacion) {
      throw new ForbiddenException('No estás asignado a ningún negocio.');
    }
    if (asignacion.estado !== AYUDANTE_ACTIVO) {
      throw new ForbiddenException(
        'Tu cuenta de ayudante no está activa. Consulta con el jefe de tu negocio.',
      );
    }
    if (!asignacion.negocioActivo) {
      throw new ForbiddenException('El negocio no está activo.');
    }
    return asignacion;
  }

  /** El negocio debe estar aceptado en el evento y el evento debe realizarse hoy. */
  private async requireEventoEnCurso(negocioId: string, eventoId: string) {
    const [aceptados, evento] = await Promise.all([
      findEventosAceptados(this.prisma, [negocioId]),
      this.prisma.evento.findFirst({
        where: {
          id: eventoId,
          estado: EventoEstado.PUBLICADO,
          fechas: { some: { fecha: dayToDate(todayIn(this.timeZone)) } },
        },
        select: { id: true, titulo: true },
      }),
    ]);
    if (!aceptados.includes(eventoId)) {
      throw new ForbiddenException(
        'Tu negocio no está habilitado para vender en este evento.',
      );
    }
    if (!evento) {
      throw new BadRequestException(
        'Solo se puede cobrar durante los días del evento.',
      );
    }
    return evento;
  }

  /** Identifica al cliente por el código de su manilla física o el QR de su entrada digital. */
  private async resolveCliente(
    eventoId: string,
    rawCodigo: string,
  ): Promise<ClienteResuelto> {
    const codigo = rawCodigo.trim();
    const candidatos = [...new Set([codigo, codigo.toUpperCase()])];

    const entrada = await this.prisma.entrada.findFirst({
      where: {
        OR: [
          { codigoQr: { in: candidatos } },
          { codigo: { in: candidatos } },
          {
            credencial: { is: { codigoQr: { in: candidatos }, activa: true } },
          },
          {
            manilla: {
              is: {
                eventoId,
                codigoFisico: { in: candidatos },
                vinculada: true,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        codigo: true,
        codigoQr: true,
        eventoId: true,
        estado: true,
        titularId: true,
        categoriaId: true,
      },
    });

    if (!entrada) {
      const manillaSinVincular = await this.prisma.manilla.findFirst({
        where: { eventoId, codigoFisico: { in: candidatos } },
        select: { id: true },
      });
      if (manillaSinVincular) {
        throw new BadRequestException(
          'Esta manilla todavía no está vinculada a una entrada.',
        );
      }
      throw new NotFoundException(
        'No se encontró ninguna entrada o manilla con ese código.',
      );
    }
    if (entrada.eventoId !== eventoId) {
      throw new BadRequestException('Este código pertenece a otro evento.');
    }
    if (ENTRADA_INVALIDA.includes(entrada.estado)) {
      throw new BadRequestException(
        'La entrada está anulada o fue reembolsada.',
      );
    }
    if (!entrada.titularId) {
      throw new BadRequestException(
        'La entrada no tiene un titular con cuenta activa.',
      );
    }

    const esQrDigital =
      candidatos.includes(entrada.codigo) ||
      candidatos.includes(entrada.codigoQr);
    const [titular, categoria, manilla] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: entrada.titularId },
        select: { id: true, nombre: true, apellido: true, activo: true },
      }),
      this.prisma.categoriaEntrada.findUnique({
        where: { id: entrada.categoriaId },
        select: { nombre: true },
      }),
      esQrDigital
        ? null
        : this.prisma.manilla.findFirst({
            where: { entradaId: entrada.id, codigoFisico: { in: candidatos } },
            select: { codigoFisico: true },
          }),
    ]);
    if (!titular?.activo) {
      throw new BadRequestException(
        'La entrada no tiene un titular con cuenta activa.',
      );
    }

    return {
      entradaId: entrada.id,
      usuarioId: titular.id,
      nombre: nombreCompleto(titular) ?? 'Cliente',
      medio: manilla ? 'MANILLA' : 'QR_DIGITAL',
      identificador: manilla ? manilla.codigoFisico : entrada.codigo,
      categoria: categoria?.nombre ?? '',
    };
  }

  private saldoInsuficiente(saldo: Prisma.Decimal, total: Prisma.Decimal) {
    return new ConflictException({
      statusCode: 409,
      error: 'Conflict',
      code: 'SALDO_INSUFICIENTE',
      message: `Saldo insuficiente. El cliente tiene Bs ${saldo.toFixed(2)} y el cobro es de Bs ${total.toFixed(2)}.`,
      saldo: saldo.toFixed(2),
      total: total.toFixed(2),
      faltante: total.sub(saldo).toFixed(2),
    });
  }
}
