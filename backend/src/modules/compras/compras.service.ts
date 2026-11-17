import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompraEstado, EventoEstado, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  StorageService,
  StoredFile,
} from '../../common/storage/storage.service';
import { MailService } from '../../common/mail/mail.service';
import {
  normalizeEmail,
  normalizePhone,
} from '../../common/security/user-identity';
import { EntradasService } from '../entradas/entradas.service';
import { EMISION_TX_OPTIONS } from '../entradas/entradas-emision';
import { claveDia } from '../tickets/cupos';
import { dateToDay, todayIn } from '../events/event-schedule';
import { nombreCompleto } from '../manillas/manillas-helpers';
import {
  CreateCompraDto,
  ListComprasQuery,
  MAX_ENTRADAS_POR_COMPRA,
  RechazarCompraDto,
  UpdatePagoEventoDto,
} from './dto/compras.dto';
import { vincularEntradasDeTerceros } from './entradas-terceros';

type AuthUser = { id: string };

/** Compras sin revisar que un usuario puede tener a la vez en un mismo evento. */
const MAX_PENDIENTES_POR_EVENTO = 5;
const MAX_LISTADO = 200;

const personaSelect = {
  id: true,
  nombre: true,
  apellido: true,
  email: true,
} as const;

const compraSelect = {
  id: true,
  estado: true,
  montoTotal: true,
  comprobanteUrl: true,
  observaciones: true,
  createdAt: true,
  revisadoAt: true,
  usuario: { select: { ...personaSelect, telefono: true, documento: true } },
  revisadoPorId: true,
  evento: {
    select: {
      id: true,
      titulo: true,
      fotoUrl: true,
      estado: true,
      tipoAcceso: true,
      ubicacion: true,
    },
  },
  pago: { select: { referencia: true, monto: true } },
  items: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      cantidad: true,
      precioUnit: true,
      fechaId: true,
      paraNombre: true,
      paraEmail: true,
      paraTelefono: true,
      categoria: { select: { id: true, nombre: true } },
      entrada: { select: { codigo: true, titularId: true } },
    },
  },
  entradas: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      codigo: true,
      estado: true,
      categoria: { select: { nombre: true } },
      fecha: { select: { fecha: true } },
      titular: { select: personaSelect },
    },
  },
} satisfies Prisma.CompraEntradaSelect;

type CompraCompleta = Prisma.CompraEntradaGetPayload<{
  select: typeof compraSelect;
}>;
type CompraPresentada = ReturnType<typeof presentarCompra>;

function precioConDescuento(precio: Prisma.Decimal, descuento: number) {
  return precio
    .mul(100 - descuento)
    .div(100)
    .toDecimalPlaces(2);
}

function formatDia(fecha: Date) {
  return fecha.toLocaleDateString('es-BO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

type Revisor = { id: string; nombre: string; apellido: string | null };

function presentarCompra(
  c: CompraCompleta,
  fechas: Map<string, Date>,
  revisores: Map<string, Revisor>,
) {
  const revisor = c.revisadoPorId ? revisores.get(c.revisadoPorId) : undefined;
  return {
    id: c.id,
    estado: c.estado,
    montoTotal: c.montoTotal.toFixed(2),
    comprobanteUrl: c.comprobanteUrl,
    referencia: c.pago?.referencia ?? null,
    motivoRechazo: c.estado === CompraEstado.RECHAZADA ? c.observaciones : null,
    createdAt: c.createdAt,
    revisadoAt: c.revisadoAt,
    revisadoPor: revisor
      ? { id: revisor.id, nombre: nombreCompleto(revisor) }
      : null,
    comprador: {
      id: c.usuario.id,
      nombre: nombreCompleto(c.usuario),
      email: c.usuario.email,
      telefono: c.usuario.telefono,
      documento: c.usuario.documento,
    },
    evento: c.evento,
    totalEntradas: c.items.reduce((sum, i) => sum + i.cantidad, 0),
    items: c.items.map((i) => ({
      id: i.id,
      categoriaId: i.categoria.id,
      categoria: i.categoria.nombre,
      cantidad: i.cantidad,
      precioUnit: i.precioUnit.toFixed(2),
      subtotal: i.precioUnit.mul(i.cantidad).toFixed(2),
      fechaId: i.fechaId,
      fecha: i.fechaId ? (fechas.get(i.fechaId) ?? null) : null,
      paraNombre: i.paraNombre,
      paraEmail: i.paraEmail,
      paraTelefono: i.paraTelefono,
      codigoEntrada: i.entrada?.codigo ?? null,
      entregadaATitular: Boolean(i.entrada?.titularId),
    })),
    entradas: c.entradas.map((e) => ({
      id: e.id,
      codigo: e.codigo,
      estado: e.estado,
      categoria: e.categoria.nombre,
      fecha: e.fecha?.fecha ?? null,
      titular: e.titular
        ? {
            id: e.titular.id,
            nombre: nombreCompleto(e.titular),
            email: e.titular.email,
          }
        : null,
    })),
  };
}

/**
 * Módulo A del Sprint 2: compra de entradas (HU-010, HU-011), comprobante de pago (HU-012)
 * y verificación del pago por el administrador (HU-013).
 */
@Injectable()
export class ComprasService {
  private readonly logger = new Logger(ComprasService.name);
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private mail: MailService,
    private entradas: EntradasService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  // Comprador

  /** Todo lo necesario para armar la compra: categorías con descuento, días a la venta y QR de pago. */
  async checkout(eventoId: string) {
    const evento = await this.prisma.evento.findFirst({
      where: { id: eventoId, estado: EventoEstado.PUBLICADO },
      select: {
        id: true,
        titulo: true,
        fotoUrl: true,
        ubicacion: true,
        tipoAcceso: true,
        qrPagoUrl: true,
        instruccionesPago: true,
        fechas: {
          orderBy: { fecha: 'asc' },
          select: { id: true, fecha: true, horaInicio: true, horaFin: true },
        },
        categorias: {
          orderBy: { precio: 'asc' },
          select: {
            id: true,
            nombre: true,
            precio: true,
            descuento: true,
            beneficios: true,
            cupo: true,
            fechasDisponibles: {
              where: { disponible: true },
              select: { fechaId: true },
            },
          },
        },
      },
    });
    if (!evento)
      throw new NotFoundException('Evento no encontrado o no está a la venta.');

    const today = todayIn(this.timeZone);
    const vigentes = new Set(
      evento.fechas.filter((f) => dateToDay(f.fecha) >= today).map((f) => f.id),
    );
    const disponibles = await this.disponibles(evento.categorias);
    const { categorias, fechas, qrPagoUrl, instruccionesPago, ...rest } =
      evento;

    return {
      evento: {
        ...rest,
        multiDia: fechas.length > 1,
        fechas: fechas.map((f) => ({ ...f, aLaVenta: vigentes.has(f.id) })),
      },
      categorias: categorias.map(({ fechasDisponibles, cupo, ...c }) => {
        const fechaIds = fechasDisponibles
          .map((f) => f.fechaId)
          .filter((id) => vigentes.has(id));
        const porDia = Object.fromEntries(
          fechaIds.map((f) => [f, disponibles.get(claveDia(c.id, f)) ?? 0]),
        );
        return {
          ...c,
          precioFinal: precioConDescuento(c.precio, c.descuento).toFixed(2),
          /** Entradas que se venden por cada día del evento. */
          cupoPorDia: cupo,
          fechaIds,
          /** Entradas que quedan a la venta en cada día (el cupo es por día). */
          disponiblesPorDia: porDia,
          disponibles: Object.values(porDia).reduce((s, n) => s + n, 0),
        };
      }),
      pago: { habilitado: Boolean(qrPagoUrl), qrPagoUrl, instruccionesPago },
      maxEntradas: MAX_ENTRADAS_POR_COMPRA,
    };
  }

  async crear(
    user: AuthUser,
    eventoId: string,
    dto: CreateCompraDto,
    comprobante?: Express.Multer.File,
  ) {
    const evento = await this.prisma.evento.findFirst({
      where: { id: eventoId, estado: EventoEstado.PUBLICADO },
      select: {
        id: true,
        qrPagoUrl: true,
        fechas: {
          orderBy: { fecha: 'asc' },
          select: { id: true, fecha: true },
        },
        categorias: {
          select: {
            id: true,
            nombre: true,
            precio: true,
            descuento: true,
            cupo: true,
            fechasDisponibles: {
              where: { disponible: true },
              select: { fechaId: true },
            },
          },
        },
      },
    });
    if (!evento)
      throw new NotFoundException('Evento no encontrado o no está a la venta.');
    if (!evento.qrPagoUrl) {
      throw new BadRequestException(
        'La venta de entradas de este evento todavía no está habilitada.',
      );
    }

    const today = todayIn(this.timeZone);
    const vigentes = new Set(
      evento.fechas.filter((f) => dateToDay(f.fecha) >= today).map((f) => f.id),
    );
    if (!vigentes.size)
      throw new BadRequestException(
        'Este evento ya se realizó y no vende más entradas.',
      );
    const multiDia = evento.fechas.length > 1;

    const comprador = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true },
    });
    const emailComprador = normalizeEmail(comprador.email);

    const lineas = dto.items.map((item, i) => {
      const n = i + 1;
      const categoria = evento.categorias.find(
        (c) => c.id === item.categoriaId,
      );
      if (!categoria)
        throw new BadRequestException(
          `La entrada ${n} tiene una categoría que no pertenece a este evento.`,
        );

      const fechaId = multiDia ? item.fechaId : evento.fechas[0]?.id;
      if (!fechaId)
        throw new BadRequestException(
          `Selecciona el día de la entrada ${n} (${categoria.nombre}).`,
        );
      if (!evento.fechas.some((f) => f.id === fechaId)) {
        throw new BadRequestException(
          `El día elegido para la entrada ${n} no pertenece a este evento.`,
        );
      }
      if (!vigentes.has(fechaId))
        throw new BadRequestException(
          `El día elegido para la entrada ${n} ya pasó.`,
        );
      if (!categoria.fechasDisponibles.some((f) => f.fechaId === fechaId)) {
        throw new BadRequestException(
          `La categoría "${categoria.nombre}" no está disponible el día elegido para la entrada ${n}.`,
        );
      }

      const esTercero = Boolean(
        item.paraNombre || item.paraEmail || item.paraTelefono,
      );
      let tercero: {
        paraNombre: string;
        paraEmail: string;
        paraTelefono: string;
      } | null = null;
      if (esTercero) {
        if (!item.paraNombre || !item.paraEmail || !item.paraTelefono) {
          throw new BadRequestException(
            `Completa el nombre, correo y celular de la persona de la entrada ${n}.`,
          );
        }
        if (item.cantidad !== 1) {
          throw new BadRequestException(
            `Cada entrada para otra persona es independiente: la entrada ${n} debe ser de una unidad.`,
          );
        }
        const paraEmail = normalizeEmail(item.paraEmail);
        if (paraEmail === emailComprador) {
          throw new BadRequestException(
            `La entrada ${n} está a tu nombre: agrégala como entrada personal.`,
          );
        }
        tercero = {
          paraNombre: item.paraNombre,
          paraEmail,
          paraTelefono: normalizePhone(item.paraTelefono)!,
        };
      }

      return {
        categoriaId: categoria.id,
        categoria: categoria.nombre,
        fechaId,
        cantidad: item.cantidad,
        precioUnit: precioConDescuento(categoria.precio, categoria.descuento),
        ...(tercero ?? {}),
      };
    });

    const totalEntradas = lineas.reduce((sum, l) => sum + l.cantidad, 0);
    if (totalEntradas > MAX_ENTRADAS_POR_COMPRA) {
      throw new BadRequestException(
        `Puedes comprar hasta ${MAX_ENTRADAS_POR_COMPRA} entradas por compra.`,
      );
    }
    await this.ensureDisponibles(lineas, evento.categorias, multiDia);

    const pendientes = await this.prisma.compraEntrada.count({
      where: { usuarioId: user.id, eventoId, estado: CompraEstado.PENDIENTE },
    });
    if (pendientes >= MAX_PENDIENTES_POR_EVENTO) {
      throw new ConflictException(
        `Ya tienes ${pendientes} compras de este evento esperando verificación. Espera a que se revisen antes de comprar de nuevo.`,
      );
    }

    const montoTotal = lineas.reduce(
      (sum, l) => sum.add(l.precioUnit.mul(l.cantidad)),
      new Prisma.Decimal(0),
    );
    if (montoTotal.gt(0) && !comprobante) {
      throw new BadRequestException(
        'Adjunta la imagen del comprobante de pago para finalizar la compra.',
      );
    }

    let stored: StoredFile | null = null;
    if (comprobante)
      stored = await this.storage.upload(
        comprobante,
        'comprobantes',
        'imageOrPdf',
      );
    try {
      const compra = await this.prisma.compraEntrada.create({
        data: {
          usuarioId: user.id,
          eventoId,
          estado: CompraEstado.PENDIENTE,
          montoTotal,
          comprobanteUrl: stored?.url ?? null,
          items: {
            create: lineas.map((l) => ({
              categoriaId: l.categoriaId,
              fechaId: l.fechaId,
              cantidad: l.cantidad,
              precioUnit: l.precioUnit,
              paraNombre: l.paraNombre ?? null,
              paraEmail: l.paraEmail ?? null,
              paraTelefono: l.paraTelefono ?? null,
            })),
          },
          pago: {
            create: {
              monto: montoTotal,
              comprobanteUrl: stored?.url ?? null,
              referencia: dto.referencia ?? null,
            },
          },
        },
        select: compraSelect,
      });
      const [presentada] = await this.presentar([compra]);
      return presentada;
    } catch (err) {
      await this.storage.remove(stored?.publicId);
      throw err;
    }
  }

  async misCompras(usuarioId: string) {
    const compras = await this.prisma.compraEntrada.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      select: compraSelect,
    });
    return { compras: await this.presentar(compras) };
  }

  async cancelar(usuarioId: string, id: string) {
    const { count } = await this.prisma.compraEntrada.updateMany({
      where: { id, usuarioId, estado: CompraEstado.PENDIENTE },
      data: { estado: CompraEstado.CANCELADA },
    });
    if (!count) {
      const compra = await this.prisma.compraEntrada.findFirst({
        where: { id, usuarioId },
        select: { id: true },
      });
      if (!compra) throw new NotFoundException('Compra no encontrada');
      throw new BadRequestException(
        'Solo puedes cancelar una compra mientras espera la verificación del pago.',
      );
    }
    return this.detalle(id);
  }

  // Administrador

  async listar(query: ListComprasQuery) {
    const base: Prisma.CompraEntradaWhereInput = {
      ...(query.eventoId ? { eventoId: query.eventoId } : {}),
      ...(query.q
        ? {
            usuario: {
              OR: [
                { email: { contains: query.q } },
                { nombre: { contains: query.q } },
                { apellido: { contains: query.q } },
              ],
            },
          }
        : {}),
    };
    const where = {
      ...base,
      ...(query.estado ? { estado: query.estado } : {}),
    };
    const [compras, total, porEstado] = await Promise.all([
      this.prisma.compraEntrada.findMany({
        where,
        // Las pendientes se atienden por orden de llegada.
        orderBy: {
          createdAt: query.estado === CompraEstado.PENDIENTE ? 'asc' : 'desc',
        },
        take: MAX_LISTADO,
        select: compraSelect,
      }),
      this.prisma.compraEntrada.count({ where }),
      this.prisma.compraEntrada.groupBy({
        by: ['estado'],
        where: base,
        _count: { _all: true },
      }),
    ]);
    return {
      total,
      conteo: Object.fromEntries(
        porEstado.map((g) => [g.estado, g._count._all]),
      ),
      compras: await this.presentar(compras),
    };
  }

  async detalle(id: string) {
    const compra = await this.prisma.compraEntrada.findUnique({
      where: { id },
      select: compraSelect,
    });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    const [presentada] = await this.presentar([compra]);
    return presentada;
  }

  /**
   * HU-013 + HU-014: aprobar el pago y emitir las entradas (QR único, día elegido) en la misma transacción;
   * si no hay códigos suficientes, la compra sigue pendiente.
   */
  async aprobar(adminId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.compraEntrada.updateMany({
        where: {
          id,
          estado: CompraEstado.PENDIENTE,
          evento: { estado: { not: EventoEstado.CANCELADO } },
        },
        data: {
          estado: CompraEstado.APROBADA,
          revisadoPorId: adminId,
          revisadoAt: new Date(),
          observaciones: null,
        },
      });
      if (!count) await this.motivoNoRevisable(tx, id);
      const emision = await this.entradas.emitirParaCompra(id, tx);
      await vincularEntradasDeTerceros(tx, id, emision);
    }, EMISION_TX_OPTIONS);

    const compra = await this.detalle(id);
    const correoEnviado = await this.notificarAprobacion(compra);
    return { ...compra, correoEnviado };
  }

  async rechazar(adminId: string, id: string, dto: RechazarCompraDto) {
    const { count } = await this.prisma.compraEntrada.updateMany({
      where: { id, estado: CompraEstado.PENDIENTE },
      data: {
        estado: CompraEstado.RECHAZADA,
        revisadoPorId: adminId,
        revisadoAt: new Date(),
        observaciones: dto.motivo,
      },
    });
    if (!count) await this.motivoNoRevisable(this.prisma, id);

    const compra = await this.detalle(id);
    const correoEnviado = await this.notify(() =>
      this.mail.sendCompraRevisada(
        compra.comprador.email,
        compra.comprador.nombre ?? '',
        {
          evento: compra.evento.titulo,
          aprobada: false,
          entradas: compra.totalEntradas,
          total: compra.montoTotal,
          motivo: dto.motivo,
        },
      ),
    );
    return { ...compra, correoEnviado };
  }

  /** QR de pago del evento e instrucciones que ve el comprador (HU-012). */
  async pagoEvento(eventoId: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: {
        id: true,
        titulo: true,
        estado: true,
        qrPagoUrl: true,
        instruccionesPago: true,
      },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    const [porEstado, aprobado] = await Promise.all([
      this.prisma.compraEntrada.groupBy({
        by: ['estado'],
        where: { eventoId },
        _count: { _all: true },
      }),
      this.prisma.compraEntrada.aggregate({
        where: { eventoId, estado: CompraEstado.APROBADA },
        _sum: { montoTotal: true },
      }),
    ]);
    const { qrPagoUrl, instruccionesPago, ...rest } = evento;
    return {
      evento: rest,
      pago: { habilitado: Boolean(qrPagoUrl), qrPagoUrl, instruccionesPago },
      conteo: Object.fromEntries(
        porEstado.map((g) => [g.estado, g._count._all]),
      ),
      recaudado: (aprobado._sum.montoTotal ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  async actualizarPagoEvento(
    eventoId: string,
    dto: UpdatePagoEventoDto,
    qr?: Express.Multer.File,
  ) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: { qrPagoPublicId: true },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    if (!qr && dto.instruccionesPago === undefined) {
      throw new BadRequestException(
        'Sube la imagen del QR de pago o escribe las instrucciones.',
      );
    }
    const stored = qr ? await this.storage.upload(qr, 'pagos', 'image') : null;
    try {
      await this.prisma.evento.update({
        where: { id: eventoId },
        data: {
          ...(stored
            ? { qrPagoUrl: stored.url, qrPagoPublicId: stored.publicId }
            : {}),
          ...(dto.instruccionesPago !== undefined
            ? { instruccionesPago: dto.instruccionesPago || null }
            : {}),
        },
      });
    } catch (err) {
      await this.storage.remove(stored?.publicId);
      throw err;
    }
    if (stored) await this.storage.remove(evento.qrPagoPublicId);
    return this.pagoEvento(eventoId);
  }

  /** Sin QR de pago el evento deja de vender entradas; las compras ya enviadas se siguen revisando. */
  async quitarQrPago(eventoId: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: { qrPagoPublicId: true },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    await this.prisma.evento.update({
      where: { id: eventoId },
      data: { qrPagoUrl: null, qrPagoPublicId: null },
    });
    await this.storage.remove(evento.qrPagoPublicId);
    return this.pagoEvento(eventoId);
  }

  // Apoyo

  /**
   * Entradas a la venta por categoría y día (clave `claveDia`). El cupo de la categoría es por día:
   * a ese cupo se le restan las entradas ya emitidas para el día y las que esperan verificación.
   * Si al emitir faltan códigos en el pool, la emisión los completa (`completarPool`).
   */
  private async disponibles(
    categorias: Array<{
      id: string;
      cupo: number;
      fechasDisponibles: { fechaId: string }[];
    }>,
  ) {
    const resultado = new Map<string, number>();
    if (!categorias.length) return resultado;
    const categoriaId = { in: categorias.map((c) => c.id) };
    const [emitidas, reservadas] = await Promise.all([
      this.prisma.entrada.groupBy({
        by: ['categoriaId', 'fechaId'],
        where: { categoriaId },
        _count: { _all: true },
      }),
      this.prisma.compraEntradaItem.groupBy({
        by: ['categoriaId', 'fechaId'],
        where: { categoriaId, compra: { estado: CompraEstado.PENDIENTE } },
        _sum: { cantidad: true },
      }),
    ]);
    const ocupadas = new Map<string, number>();
    for (const e of emitidas)
      ocupadas.set(claveDia(e.categoriaId, e.fechaId), e._count._all);
    for (const r of reservadas) {
      const k = claveDia(r.categoriaId, r.fechaId);
      ocupadas.set(k, (ocupadas.get(k) ?? 0) + (r._sum.cantidad ?? 0));
    }
    for (const c of categorias) {
      for (const { fechaId } of c.fechasDisponibles) {
        const k = claveDia(c.id, fechaId);
        resultado.set(k, Math.max(0, c.cupo - (ocupadas.get(k) ?? 0)));
      }
    }
    return resultado;
  }

  private async ensureDisponibles(
    lineas: Array<{
      categoriaId: string;
      categoria: string;
      fechaId: string;
      cantidad: number;
    }>,
    categorias: Array<{
      id: string;
      cupo: number;
      fechasDisponibles: { fechaId: string }[];
    }>,
    multiDia: boolean,
  ) {
    const pedidas = new Map<string, { nombre: string; cantidad: number }>();
    for (const l of lineas) {
      const k = claveDia(l.categoriaId, l.fechaId);
      const acc = pedidas.get(k) ?? { nombre: l.categoria, cantidad: 0 };
      acc.cantidad += l.cantidad;
      pedidas.set(k, acc);
    }
    const ids = new Set(lineas.map((l) => l.categoriaId));
    const disponibles = await this.disponibles(
      categorias.filter((c) => ids.has(c.id)),
    );
    const delDia = multiDia ? ' para ese día' : '';
    for (const [k, { nombre, cantidad }] of pedidas) {
      const hay = disponibles.get(k) ?? 0;
      if (cantidad > hay) {
        throw new ConflictException(
          hay
            ? `Solo quedan ${hay} entradas "${nombre}" disponibles${delDia}.`
            : `Las entradas "${nombre}" están agotadas${delDia}.`,
        );
      }
    }
  }

  private async motivoNoRevisable(
    db: Pick<Prisma.TransactionClient, 'compraEntrada'>,
    id: string,
  ): Promise<never> {
    const compra = await db.compraEntrada.findUnique({
      where: { id },
      select: { estado: true, evento: { select: { estado: true } } },
    });
    if (!compra) throw new NotFoundException('Compra no encontrada');
    if (
      compra.estado === CompraEstado.PENDIENTE &&
      compra.evento.estado === EventoEstado.CANCELADO
    ) {
      throw new BadRequestException(
        'El evento fue cancelado: no se pueden aprobar compras.',
      );
    }
    throw new ConflictException(
      `Esta compra ya fue revisada (${compra.estado.toLowerCase()}).`,
    );
  }

  private async notificarAprobacion(compra: CompraPresentada) {
    const enviado = await this.notify(() =>
      this.mail.sendCompraRevisada(
        compra.comprador.email,
        compra.comprador.nombre ?? '',
        {
          evento: compra.evento.titulo,
          aprobada: true,
          entradas: compra.totalEntradas,
          total: compra.montoTotal,
        },
      ),
    );
    for (const item of compra.items) {
      if (!item.paraEmail) continue;
      await this.notify(() =>
        this.mail.sendEntradaParaTercero(
          item.paraEmail!,
          item.paraNombre ?? '',
          {
            evento: compra.evento.titulo,
            comprador: compra.comprador.nombre ?? compra.comprador.email,
            categoria: item.categoria,
            dia: item.fecha
              ? formatDia(item.fecha)
              : 'todos los días del evento',
            tieneCuenta: item.entregadaATitular,
          },
        ),
      );
    }
    return enviado;
  }

  /** La acción principal ya se guardó: si el correo falla se informa, pero no se revierte. */
  private async notify(send: () => Promise<void>) {
    try {
      await send();
      return true;
    } catch (err) {
      this.logger.warn(`Notificación no enviada: ${(err as Error).message}`);
      return false;
    }
  }

  /** CompraEntradaItem guarda el id del día sin relación: los días se cargan en una sola consulta. */
  private async presentar(compras: CompraCompleta[]) {
    const definidos = (ids: (string | null)[]) => [
      ...new Set(ids.filter((id): id is string => Boolean(id))),
    ];
    const fechaIds = definidos(
      compras.flatMap((c) => c.items.map((i) => i.fechaId)),
    );
    const revisorIds = definidos(compras.map((c) => c.revisadoPorId));
    const [fechas, revisores] = await Promise.all([
      fechaIds.length
        ? this.prisma.fechaEvento.findMany({
            where: { id: { in: fechaIds } },
            select: { id: true, fecha: true },
          })
        : [],
      revisorIds.length
        ? this.prisma.usuario.findMany({
            where: { id: { in: revisorIds } },
            select: { id: true, nombre: true, apellido: true },
          })
        : [],
    ]);
    const fechasPorId = new Map(fechas.map((f) => [f.id, f.fecha]));
    const revisoresPorId = new Map(revisores.map((r) => [r.id, r]));
    return compras.map((c) => presentarCompra(c, fechasPorId, revisoresPorId));
  }
}
