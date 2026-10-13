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
  /** Cómo se identificó al cliente: QR digital de la entrada o manilla física. */
  medio: 'QR_DIGITAL' | 'MANILLA';
  identificador: string;
  categoria: string;
}

/**
 * Identifica al titular de una entrada a partir del código escaneado en el evento.
 * Lo usan el punto de venta (cobros) y el recargador (recargas).
 *
 * Mismas reglas que el control de acceso (HU-015): vale la manilla física vinculada o el QR
 * digital activo de la entrada. Una vez vinculada la manilla solo vale su QR físico, y en eventos
 * con manilla el QR de la entrada sirve únicamente para retirarla en un punto de entrega.
 */
@Injectable()
export class CodigoClienteService {
  constructor(private prisma: PrismaService) {}

  async resolver(
    eventoId: string,
    rawCodigo: string,
  ): Promise<ClienteResuelto> {
    const codigo = rawCodigo.trim();
    if (!codigo) throw new BadRequestException('Escanea o ingresa un código.');
    const candidatos = [...new Set([codigo, codigo.toUpperCase()])];

    const manilla = await this.prisma.manilla.findFirst({
      where: { eventoId, codigoFisico: { in: candidatos } },
      select: { vinculada: true, entradaId: true, codigoFisico: true },
    });
    if (manilla) {
      if (!manilla.vinculada || !manilla.entradaId) {
        throw new BadRequestException(
          'Esta manilla todavía no está vinculada a una entrada.',
        );
      }
      return this.titular(manilla.entradaId, 'MANILLA', manilla.codigoFisico);
    }

    const credencial = await this.prisma.credencial.findFirst({
      where: { codigoQr: { in: candidatos } },
      select: {
        activa: true,
        entradaId: true,
        entrada: {
          select: {
            eventoId: true,
            codigo: true,
            manilla: { select: { vinculada: true } },
          },
        },
      },
    });
    if (credencial) {
      if (credencial.entrada.eventoId !== eventoId) {
        throw new BadRequestException('Este código pertenece a otro evento.');
      }
      if (credencial.entrada.manilla?.vinculada) {
        throw new BadRequestException(
          'Esta entrada ya tiene su manilla: escanea el QR de la manilla.',
        );
      }
      if (!credencial.activa) {
        throw new BadRequestException('Este QR digital fue desactivado.');
      }
      return this.titular(
        credencial.entradaId,
        'QR_DIGITAL',
        credencial.entrada.codigo,
      );
    }

    const entrada = await this.prisma.entrada.findFirst({
      where: {
        OR: [{ codigoQr: { in: candidatos } }, { codigo: { in: candidatos } }],
      },
      select: { eventoId: true, manilla: { select: { vinculada: true } } },
    });
    if (entrada) {
      if (entrada.eventoId !== eventoId) {
        throw new BadRequestException('Este código pertenece a otro evento.');
      }
      throw new BadRequestException(
        entrada.manilla?.vinculada
          ? 'Esta entrada ya tiene su manilla: escanea el QR de la manilla.'
          : 'Este QR solo sirve para recoger la manilla en un punto de entrega.',
      );
    }
    throw new NotFoundException(
      'No se encontró ninguna entrada o manilla con ese código.',
    );
  }

  private async titular(
    entradaId: string,
    medio: ClienteResuelto['medio'],
    identificador: string,
  ): Promise<ClienteResuelto> {
    const entrada = await this.prisma.entrada.findUnique({
      where: { id: entradaId },
      select: {
        estado: true,
        categoria: { select: { nombre: true } },
        titular: {
          select: { id: true, nombre: true, apellido: true, activo: true },
        },
      },
    });
    if (!entrada) {
      throw new NotFoundException(
        'No se encontró ninguna entrada o manilla con ese código.',
      );
    }
    if (ENTRADA_INVALIDA.includes(entrada.estado)) {
      throw new BadRequestException(
        'La entrada está anulada o fue reembolsada.',
      );
    }
    if (!entrada.titular?.activo) {
      throw new BadRequestException(
        'La entrada no tiene un titular con cuenta activa.',
      );
    }
    return {
      entradaId,
      usuarioId: entrada.titular.id,
      nombre: nombreCompleto(entrada.titular) ?? 'Cliente',
      medio,
      identificador,
      categoria: entrada.categoria.nombre,
    };
  }
}
