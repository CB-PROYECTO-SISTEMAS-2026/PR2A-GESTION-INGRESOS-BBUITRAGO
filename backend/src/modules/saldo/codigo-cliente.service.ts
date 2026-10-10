import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntradaEstado } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { nombreCompleto } from '../pos/pos-helpers';

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

/**
 * Identifica al titular de una entrada a partir del código escaneado en el evento: QR de la
 * entrada digital, QR de la credencial o código de la manilla física vinculada.
 * Lo usan el punto de venta (cobros) y el recargador (recargas).
 */
@Injectable()
export class CodigoClienteService {
  constructor(private prisma: PrismaService) {}

  async resolver(
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
}
