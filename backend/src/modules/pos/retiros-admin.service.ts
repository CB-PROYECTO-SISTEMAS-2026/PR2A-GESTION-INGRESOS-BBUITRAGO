import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { money, nombreCompleto } from './pos-helpers';

/** Estados de RetiroGanancias (la columna es texto libre en el schema). */
export const RETIRO_ESTADOS = [
  'SOLICITADO',
  'APROBADO',
  'PAGADO',
  'RECHAZADO',
] as const;
export type RetiroEstado = (typeof RETIRO_ESTADOS)[number];

/** Desde qué estados se puede pasar a cada uno. PAGADO exige comprobante (ver `pagar`). */
const TRANSICIONES: Record<'APROBADO' | 'RECHAZADO', RetiroEstado[]> = {
  APROBADO: ['SOLICITADO'],
  RECHAZADO: ['SOLICITADO', 'APROBADO'],
};

/**
 * HU-025 (cierre): el administrador revisa las solicitudes de retiro de los dueños de negocio,
 * las aprueba o rechaza y registra el pago con su comprobante. Un retiro RECHAZADO deja de contar
 * como retirado, así el monto vuelve a estar disponible para el negocio.
 */
@Injectable()
export class RetirosAdminService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async listar(estado?: RetiroEstado) {
    const [retiros, porEstado] = await Promise.all([
      this.prisma.retiroGanancias.findMany({
        where: estado ? { estado } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          monto: true,
          estado: true,
          evidenciaUrl: true,
          createdAt: true,
          updatedAt: true,
          negocioId: true,
        },
      }),
      this.prisma.retiroGanancias.groupBy({
        by: ['estado'],
        _count: { _all: true },
        _sum: { monto: true },
      }),
    ]);
    // Solo columnas que existen en ambas versiones del schema de Negocio.
    const negocios = await this.prisma.negocio.findMany({
      where: { id: { in: [...new Set(retiros.map((r) => r.negocioId))] } },
      select: {
        id: true,
        nombre: true,
        dueno: { select: { nombre: true, apellido: true, email: true } },
      },
    });
    const negocio = new Map(negocios.map((n) => [n.id, n]));

    return {
      resumen: RETIRO_ESTADOS.map((e) => {
        const g = porEstado.find((p) => p.estado === e);
        return {
          estado: e,
          cantidad: g?._count._all ?? 0,
          monto: money(g?._sum.monto),
        };
      }),
      retiros: retiros.map((r) => {
        const n = negocio.get(r.negocioId);
        return {
          id: r.id,
          monto: money(r.monto),
          estado: r.estado,
          evidenciaUrl: r.evidenciaUrl,
          fecha: r.createdAt,
          actualizado: r.updatedAt,
          negocio: n?.nombre ?? 'Negocio',
          dueno: nombreCompleto(n?.dueno) ?? '',
          email: n?.dueno.email ?? '',
        };
      }),
    };
  }

  /** Aprueba o rechaza una solicitud. */
  async cambiarEstado(id: string, estado: 'APROBADO' | 'RECHAZADO') {
    const desde = TRANSICIONES[estado];
    const { count } = await this.prisma.retiroGanancias.updateMany({
      where: { id, estado: { in: desde } },
      data: { estado },
    });
    if (!count) await this.transicionInvalida(id, estado);
    return this.detalle(id);
  }

  /** Marca el retiro como pagado y guarda el comprobante de la transferencia o entrega. */
  async pagar(id: string, evidencia: Express.Multer.File | undefined) {
    if (!evidencia) {
      throw new BadRequestException(
        'Adjunta el comprobante del pago (imagen o PDF).',
      );
    }
    const actual = await this.prisma.retiroGanancias.findUnique({
      where: { id },
      select: { estado: true },
    });
    if (!actual) throw new NotFoundException('Retiro no encontrado');
    if (actual.estado !== 'APROBADO') {
      throw new ConflictException(
        'Solo se puede registrar el pago de un retiro aprobado.',
      );
    }

    const stored = await this.storage.upload(
      evidencia,
      'retiros',
      'imageOrPdf',
    );
    const { count } = await this.prisma.retiroGanancias.updateMany({
      where: { id, estado: 'APROBADO' },
      data: { estado: 'PAGADO', evidenciaUrl: stored.url },
    });
    if (!count) {
      // Otro administrador lo cambió mientras se subía el archivo.
      await this.storage.remove(stored.publicId);
      throw new ConflictException(
        'El retiro cambió de estado. Actualiza la lista.',
      );
    }
    return this.detalle(id);
  }

  private async detalle(id: string) {
    const r = await this.prisma.retiroGanancias.findUniqueOrThrow({
      where: { id },
      select: { id: true, monto: true, estado: true, evidenciaUrl: true },
    });
    return { ...r, monto: money(r.monto) };
  }

  private async transicionInvalida(id: string, estado: string): Promise<never> {
    const actual = await this.prisma.retiroGanancias.findUnique({
      where: { id },
      select: { estado: true },
    });
    if (!actual) throw new NotFoundException('Retiro no encontrado');
    throw new ConflictException(
      `No se puede pasar un retiro ${actual.estado} a ${estado}.`,
    );
  }
}
