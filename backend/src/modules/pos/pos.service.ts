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
  descontarStock,
  findAyudanteAsignacion,
  findEventosAceptados,
  findStockNegocio,
} from './negocio-compat';
import { horarioActual, resolveDayRange } from './pos-dates';
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

const DAY_MS = 24 * 60 * 60 * 1000;

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

function isUniqueViolation(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
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

    const [eventos, productos, stock] = await Promise.all([
      findEventosAceptados(this.prisma, [asignacion.negocioId]).then((ids) =>
        this.prisma.evento.findMany({
          where: { id: { in: ids }, estado: EventoEstado.PUBLICADO },
          select: {
            id: true,
            titulo: true,
            fechas: {
              select: { fecha: true, horaInicio: true, horaFin: true },
              orderBy: { fecha: 'asc' },
            },
          },
        }),
      ),
      this.prisma.producto.findMany({
        where: { negocioId: asignacion.negocioId, activo: true },
        select: { id: true, nombre: true, precio: true, descripcion: true },
        orderBy: { nombre: 'asc' },
      }),
      findStockNegocio(this.prisma, asignacion.negocioId),
    ]);

    return {
      negocio: { id: asignacion.negocioId, nombre: asignacion.negocioNombre },
      hoy: today,
      eventos: eventos
        .map((e) => {
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
      productos: productos.map((p) => ({
        ...p,
        precio: money(p.precio),
        /** Unidades disponibles; null si el producto no controla stock. */
        stock: stock.get(p.id) ?? null,
      })),
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
   *
   * Idempotencia: la `idempotencyKey` se usa como id de la venta. Si el terminal reintenta un
   * cobro que ya se registró (se perdió la respuesta), la clave choca con la venta existente y
   * se devuelve ese resultado en lugar de cobrar otra vez.
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

    const ventaId = dto.idempotencyKey ?? newId();
    if (dto.idempotencyKey) {
      const previo = await this.cobroRegistrado(ventaId, ayudanteId);
      if (previo) return previo;
    }

    const asignacion = await this.requireAyudante(ayudanteId);
    const [evento, cliente, productos, stock] = await Promise.all([
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
      findStockNegocio(this.prisma, asignacion.negocioId),
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
    for (const l of lineas) {
      const disponible = stock.get(l.productoId);
      if (disponible != null && disponible < l.cantidad) {
        throw new BadRequestException(
          disponible > 0
            ? `No hay stock suficiente de ${l.nombre}: quedan ${disponible}.`
            : `${l.nombre} está agotado.`,
        );
      }
    }
    const conStock = lineas.filter((l) => stock.get(l.productoId) != null);
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
    const transaccionId = newId();
    const fecha = new Date();

    let saldoResultante: Prisma.Decimal;
    try {
      saldoResultante = await this.prisma.$transaction(async (tx) => {
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
        if (!(await descontarStock(tx, conStock))) {
          throw new ConflictException(
            'Un producto se agotó mientras se cobraba. Actualiza el catálogo e inténtalo de nuevo.',
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
    } catch (err) {
      // Dos envíos simultáneos con la misma clave: el segundo choca con la venta del primero.
      if (dto.idempotencyKey && isUniqueViolation(err)) {
        const previo = await this.cobroRegistrado(ventaId, ayudanteId);
        if (previo) return previo;
      }
      throw err;
    }

    return {
      ventaId,
      transaccionId,
      codigo: codigoTransaccion(transaccionId),
      fecha,
      repetido: false,
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

  /**
   * Resultado de un cobro ya registrado con esta clave (reintento del terminal), o null si no
   * existe. Si la clave pertenece a la venta de otro ayudante, se rechaza.
   */
  private async cobroRegistrado(ventaId: string, ayudanteId: string) {
    const venta = await this.prisma.venta.findUnique({
      where: { id: ventaId },
      select: {
        ...VENTA_ROW_SELECT,
        detalles: {
          select: {
            cantidad: true,
            productoId: true,
            precioUnit: true,
            subtotal: true,
          },
        },
        transacciones: {
          select: { id: true, saldoResultante: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!venta) return null;
    if (venta.ayudanteId !== ayudanteId) {
      throw new ConflictException('La clave de este cobro ya fue utilizada.');
    }
    const nombres = await nombresDeVentas(this.prisma, [venta]);
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: venta.detalles.map((d) => d.productoId) } },
      select: { id: true, nombre: true },
    });
    const transaccion = venta.transacciones[0];
    return {
      ventaId: venta.id,
      transaccionId: transaccion?.id ?? null,
      codigo: transaccion ? codigoTransaccion(transaccion.id) : null,
      fecha: venta.createdAt,
      repetido: true,
      negocio: nombres.negocio(venta),
      evento: nombres.evento(venta),
      cliente: {
        nombre: nombres.cliente(venta),
        medio: null,
        identificador: null,
      },
      total: money(venta.total),
      saldoResultante: money(transaccion?.saldoResultante),
      detalles: venta.detalles.map((d) => ({
        nombre:
          productos.find((p) => p.id === d.productoId)?.nombre ?? 'Producto',
        cantidad: d.cantidad,
        precioUnit: money(d.precioUnit),
        subtotal: money(d.subtotal),
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

  /**
   * El negocio debe estar aceptado en el evento, y el evento debe realizarse hoy y estar dentro
   * de su horario (ver `horarioActual`: admite horarios que cruzan la medianoche).
   */
  private async requireEventoEnCurso(negocioId: string, eventoId: string) {
    const today = dayToDate(todayIn(this.timeZone));
    const yesterday = new Date(today.getTime() - DAY_MS);
    const [aceptados, evento] = await Promise.all([
      findEventosAceptados(this.prisma, [negocioId]),
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
    if (!aceptados.includes(eventoId)) {
      throw new ForbiddenException(
        'Tu negocio no está habilitado para vender en este evento.',
      );
    }
    if (!evento?.fechas.length) {
      throw new BadRequestException(
        'Solo se puede cobrar durante los días del evento.',
      );
    }
    const { abierto, horarioHoy } = horarioActual(evento.fechas, this.timeZone);
    if (!abierto) {
      throw new BadRequestException(
        horarioHoy
          ? `El evento está cerrado en este momento. Horario de hoy: ${horarioHoy}.`
          : 'Solo se puede cobrar durante el horario del evento.',
      );
    }
    return { id: evento.id, titulo: evento.titulo };
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
