import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntradaEstado, Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESO_CON_MANILLA, emitirEntradasDeCompra, EMISION_TX_OPTIONS, ENTRADA_INVALIDA } from './entradas-emision';
import { asignarEntradasDeTerceros } from '../compras/entradas-terceros';
import { MisEntradasQueryDto } from './dto/mis-entradas-query.dto';

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDayUtc(ymd: string): Date {
  const m = DAY_RE.exec(ymd);
  if (!m) throw new BadRequestException(`Fecha inválida: ${ymd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new BadRequestException(`Fecha inválida: ${ymd}`);
  }
  return dt;
}

type Tx = Prisma.TransactionClient;

const QR_OPTIONS = { margin: 1, width: 360, errorCorrectionLevel: 'M' } as const;

const miEntradaSelect = {
  id: true,
  codigo: true,
  codigoQr: true,
  estado: true,
  titularEstado: true,
  createdAt: true,
  compra: { select: { reembolsoHasta: true } },
  categoria: { select: { nombre: true } },
  fecha: { select: { fecha: true, horaInicio: true, horaFin: true } },
  credencial: { select: { codigoQr: true, activa: true } },
  manilla: {
    select: {
      codigoFisico: true,
      vinculada: true,
      vinculadaAt: true,
      puntoRetiro: { select: { nombre: true, ubicacion: true } },
    },
  },
  evento: {
    select: {
      id: true,
      titulo: true,
      fotoUrl: true,
      ubicacion: true,
      ubicacionUrl: true,
      tipoAcceso: true,
      estado: true,
      permiteTransferencias: true,
      transferenciaHasta: true,
      fechas: { orderBy: { fecha: 'asc' }, select: { fecha: true, horaInicio: true, horaFin: true } },
      puntosRetiro: {
        where: { activo: true },
        orderBy: { nombre: 'asc' },
        select: { id: true, nombre: true, ubicacion: true, horario: true },
      },
    },
  },
} satisfies Prisma.EntradaSelect;

type MiEntrada = Prisma.EntradaGetPayload<{ select: typeof miEntradaSelect }>;

@Injectable()
export class EntradasService {
  constructor(private prisma: PrismaService) {}

  /**
   * HU-014 / HU-055. Punto de integración para el Módulo A: llamarlo al aprobar la compra,
   * pasando el `tx` de la aprobación para que ambas cosas se guarden o se reviertan juntas.
   * Esa transacción debe abrirse con `EMISION_TX_OPTIONS`: el límite por defecto de Prisma (5 s)
   * no alcanza con la base remota.
   */
  emitirParaCompra(compraId: string, tx?: Tx) {
    if (tx) return emitirEntradasDeCompra(tx, compraId);
    return this.prisma.$transaction((t) => emitirEntradasDeCompra(t, compraId), EMISION_TX_OPTIONS);
  }

  /**
   * HU-015: identifica la entrada a partir de lo escaneado dentro del evento (control de acceso,
   * recargas, cobros). Una vez vinculada la manilla solo vale su QR físico; el QR de la entrada
   * sirve únicamente para retirarla en un punto de entrega.
   */
  async resolverCodigoEscaneado(eventoId: string, codigo: string) {
    const valor = codigo.trim();
    if (!valor) throw new BadRequestException('Escanea o ingresa un código.');

    const manilla = await this.prisma.manilla.findUnique({
      where: { eventoId_codigoFisico: { eventoId, codigoFisico: valor.toUpperCase() } },
      select: { vinculada: true, entradaId: true },
    });
    if (manilla) {
      if (!manilla.vinculada || !manilla.entradaId) {
        throw new BadRequestException('Esta manilla todavía no fue entregada a ningún cliente.');
      }
      return this.entradaEscaneada(eventoId, manilla.entradaId, 'MANILLA');
    }

    const credencial = await this.prisma.credencial.findUnique({
      where: { codigoQr: valor },
      select: {
        activa: true,
        entradaId: true,
        entrada: { select: { eventoId: true, manilla: { select: { vinculada: true } } } },
      },
    });
    if (credencial && credencial.entrada.eventoId === eventoId) {
      if (credencial.entrada.manilla?.vinculada) {
        throw new BadRequestException('Esta entrada ya tiene su manilla: escanea el QR de la manilla.');
      }
      if (!credencial.activa) throw new BadRequestException('Este QR digital fue desactivado.');
      return this.entradaEscaneada(eventoId, credencial.entradaId, 'QR_DIGITAL');
    }

    const entrada = await this.prisma.entrada.findFirst({
      where: { eventoId, OR: [{ codigoQr: valor }, { codigo: valor.toUpperCase() }] },
      select: { manilla: { select: { vinculada: true } } },
    });
    if (entrada) {
      throw new BadRequestException(
        entrada.manilla?.vinculada
          ? 'Esta entrada ya tiene su manilla: escanea el QR de la manilla.'
          : 'Este QR solo sirve para recoger la manilla en un punto de entrega.',
      );
    }
    throw new NotFoundException('El código no corresponde a ninguna entrada de este evento.');
  }

  private async entradaEscaneada(eventoId: string, entradaId: string, medio: 'MANILLA' | 'QR_DIGITAL') {
    const e = await this.prisma.entrada.findFirst({
      where: { id: entradaId, eventoId },
      select: {
        id: true,
        codigo: true,
        estado: true,
        fechaId: true,
        titular: { select: { id: true, nombre: true, apellido: true, documento: true, fotoUrl: true } },
      },
    });
    if (!e) throw new NotFoundException('El código no corresponde a ninguna entrada de este evento.');
    if (ENTRADA_INVALIDA.includes(e.estado)) {
      throw new BadRequestException(`La entrada ${e.codigo} está ${e.estado.toLowerCase()} y ya no es válida.`);
    }
    return { medio, entrada: e };
  }

  /** HU-055: entradas a nombre del usuario, con el QR que debe mostrar según el tipo de acceso. */
  async misEntradas(usuarioId: string, query: MisEntradasQueryDto = {}) {
    await asignarEntradasDeTerceros(this.prisma, usuarioId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const q = query.q?.trim();

    let desde = query.desde?.trim();
    let hasta = query.hasta?.trim();
    if (desde && !hasta) hasta = desde;
    if (hasta && !desde) desde = hasta;
    if (desde && hasta) {
      const d0 = parseDayUtc(desde);
      const d1 = parseDayUtc(hasta);
      if (d0.getTime() > d1.getTime()) {
        throw new BadRequestException('La fecha de inicio no puede ser posterior a la fecha de fin.');
      }
    }

    const where: Prisma.EntradaWhereInput = { titularId: usuarioId };

    if (q) {
      where.OR = [
        { codigo: { contains: q } },
        { categoria: { nombre: { contains: q } } },
        { evento: { titulo: { contains: q } } },
        { evento: { ubicacion: { contains: q } } },
      ];
    }

    if (desde && hasta) {
      const gte = parseDayUtc(desde);
      const lte = parseDayUtc(hasta);
      const fechaRango = { gte, lte };
      const prevAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [
        ...prevAnd,
        {
          OR: [
            { fecha: { fecha: fechaRango } },
            {
              fechaId: null,
              evento: { fechas: { some: { fecha: fechaRango } } },
            },
          ],
        },
      ];
    }

    const total = await this.prisma.entrada.count({ where });
    const entradas = await this.prisma.entrada.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: miEntradaSelect,
    });

    const totalPages = total ? Math.ceil(total / limit) : 0;

    return {
      entradas: await Promise.all(entradas.map((e) => this.presentar(e))),
      page,
      pageSize: limit,
      total,
      totalPages,
    };
  }

  private async presentar(e: MiEntrada) {
    const vigente = !ENTRADA_INVALIDA.includes(e.estado);
    const manillaVinculada = Boolean(e.manilla?.vinculada);
    const qrDigital = vigente && !manillaVinculada && e.credencial?.activa ? e.credencial.codigoQr : null;
    const pendienteManilla = vigente && ACCESO_CON_MANILLA.includes(e.evento.tipoAcceso) && !manillaVinculada;

    // El QR digital sirve para moverse en el evento; sin él, el QR de la entrada solo identifica al
    // titular en el punto de entrega. Con la manilla ya vinculada, se usa el QR físico.
    let qrUso: 'ACCESO' | 'RETIRO_MANILLA' | null = null;
    let qrContenido: string | null = null;
    if (qrDigital) {
      qrUso = 'ACCESO';
      qrContenido = qrDigital;
    } else if (pendienteManilla) {
      qrUso = 'RETIRO_MANILLA';
      qrContenido = e.codigoQr;
    }

    const { puntosRetiro, ...evento } = e.evento;
    return {
      id: e.id,
      codigo: e.codigo,
      estado: e.estado,
      titularEstado: e.titularEstado,
      reembolsoHasta: e.compra?.reembolsoHasta ?? null,
      emitidaAt: e.createdAt,
      categoria: e.categoria.nombre,
      fecha: e.fecha,
      evento,
      qrUso,
      qr: qrContenido ? await QRCode.toDataURL(qrContenido, QR_OPTIONS) : null,
      manilla: manillaVinculada
        ? {
            codigo: e.manilla!.codigoFisico,
            entregadaAt: e.manilla!.vinculadaAt,
            puntoRetiro: e.manilla!.puntoRetiro,
          }
        : null,
      puntosRetiro: pendienteManilla ? puntosRetiro : [],
      usada: e.estado === EntradaEstado.USADA,
    };
  }
}
