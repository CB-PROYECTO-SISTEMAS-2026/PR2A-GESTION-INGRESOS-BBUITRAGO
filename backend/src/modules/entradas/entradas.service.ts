import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntradaEstado, Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESO_CON_MANILLA, emitirEntradasDeCompra, ENTRADA_INVALIDA } from './entradas-emision';

type Tx = Prisma.TransactionClient;

const QR_OPTIONS = { margin: 1, width: 360, errorCorrectionLevel: 'M' } as const;

const miEntradaSelect = {
  id: true,
  codigo: true,
  codigoQr: true,
  estado: true,
  createdAt: true,
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
      tipoAcceso: true,
      estado: true,
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
   */
  emitirParaCompra(compraId: string, tx?: Tx) {
    if (tx) return emitirEntradasDeCompra(tx, compraId);
    return this.prisma.$transaction((t) => emitirEntradasDeCompra(t, compraId));
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
      select: { activa: true, entradaId: true, entrada: { select: { eventoId: true } } },
    });
    if (credencial && credencial.entrada.eventoId === eventoId) {
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
  async misEntradas(usuarioId: string) {
    const entradas = await this.prisma.entrada.findMany({
      where: { titularId: usuarioId },
      orderBy: { createdAt: 'desc' },
      select: miEntradaSelect,
    });
    return { entradas: await Promise.all(entradas.map((e) => this.presentar(e))) };
  }

  private async presentar(e: MiEntrada) {
    const vigente = !ENTRADA_INVALIDA.includes(e.estado);
    const manillaVinculada = Boolean(e.manilla?.vinculada);
    const qrDigital = vigente && e.credencial?.activa ? e.credencial.codigoQr : null;
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
