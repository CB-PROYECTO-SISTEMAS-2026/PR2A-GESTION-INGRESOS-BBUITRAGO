import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EntradaEstado, Prisma, ReembolsoEstado } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { StorageService } from '../../common/storage/storage.service';
import { completarPool } from '../tickets/cupos';

@Injectable()
export class ReembolsoEntradasService {
  private readonly logger = new Logger(ReembolsoEntradasService.name);

  constructor(
    private db: PrismaService,
    private mail: MailService,
    private storage: StorageService,
  ) {}

  listar(usuarioId: string | undefined, page: number) {
    return this.db.reembolsoEntrada.findMany({
      where: { usuarioId },
      include: {
        entrada: {
          select: {
            codigo: true,
            estado: true,
            evento: { select: { titulo: true, estado: true } },
          },
        },
        usuario: { select: { nombre: true, apellido: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      skip: (page - 1) * 50,
    });
  }

  async solicitar(usuarioId: string, entradaId: string, motivo: string) {
    const entrada = await this.db.entrada.findFirst({
      where: { id: entradaId, titularId: usuarioId },
      include: {
        evento: { select: { estado: true, titulo: true } },
        reembolso: true,
        itemCompra: true,
        compra: { include: { items: true } },
        _count: { select: { accesos: true } },
      },
    });
    if (!entrada) throw new NotFoundException('Entrada no encontrada.');
    if (entrada.reembolso)
      return this.reintento(entrada.reembolso, usuarioId, motivo);
    if (
      entrada._count.accesos ||
      !['GENERADA', 'ASIGNADA'].includes(entrada.estado) ||
      entrada.compra?.estado !== 'APROBADA'
    )
      throw new BadRequestException(
        'Solo puedes solicitar el reembolso de una entrada pagada y sin usar.',
      );
    if (
      entrada.evento.estado !== 'CANCELADO' &&
      entrada.compra.reembolsoHasta &&
      new Date() > entrada.compra.reembolsoHasta
    )
      throw new BadRequestException(
        'Venció el plazo de reembolso informado al comprar la entrada.',
      );
    const precios = entrada.itemCompra
      ? [entrada.itemCompra.precioUnit]
      : entrada.compra.items
          .filter(
            (i) =>
              i.categoriaId === entrada.categoriaId &&
              (i.fechaId === entrada.fechaId || i.fechaId === null) &&
              !i.paraEmail,
          )
          .map((i) => i.precioUnit);
    if (!precios.length || !precios.every((p) => p.equals(precios[0])))
      throw new ConflictException(
        'El precio pagado por esta entrada requiere conciliación.',
      );
    try {
      return await this.db.reembolsoEntrada.create({
        data: { usuarioId, entradaId, motivo, monto: precios[0] },
      });
    } catch (err) {
      if (
        !(
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        )
      )
        throw err;
      const previa = await this.db.reembolsoEntrada.findUniqueOrThrow({
        where: { entradaId },
      });
      return this.reintento(previa, usuarioId, motivo);
    }
  }

  private reintento<T extends { usuarioId: string; motivo: string | null }>(
    solicitud: T,
    usuarioId: string,
    motivo: string,
  ) {
    if (solicitud.usuarioId !== usuarioId || solicitud.motivo !== motivo)
      throw new ConflictException(
        'Ya existe otra solicitud para esta entrada.',
      );
    return solicitud;
  }

  async resolver(
    id: string,
    estado: Exclude<ReembolsoEstado, 'SOLICITADO'>,
    adminId?: string,
    evidencia?: Express.Multer.File,
  ) {
    if (estado === 'PAGADO' && !evidencia) {
      throw new BadRequestException(
        'Adjunta una foto del efectivo entregado al titular para registrar el pago.',
      );
    }
    let stored: { url: string; publicId?: string } | null = null;
    if (estado === 'PAGADO' && evidencia) {
      stored = await this.storage.upload(
        evidencia,
        'reembolsos',
        'imageOrPdf',
      );
    }
    try {
      const actualizado = await this.db.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM ReembolsoEntrada WHERE id = ${id} FOR UPDATE`,
        );
        const actual = await tx.reembolsoEntrada.findUnique({
          where: { id },
          include: {
            entrada: {
              select: {
                id: true,
                codigo: true,
                categoriaId: true,
                ticketPoolId: true,
                evento: { select: { titulo: true } },
              },
            },
            usuario: {
              select: { email: true, nombre: true, apellido: true },
            },
          },
        });
        if (!actual) throw new NotFoundException('Solicitud no encontrada.');
        if (actual.estado === estado) return actual;
        if (actual.estado !== (estado === 'PAGADO' ? 'APROBADO' : 'SOLICITADO'))
          throw new ConflictException('Transición de estado inválida.');
        if (estado === 'APROBADO') {
          const actualizadoEntrada = await tx.entrada.updateMany({
            where: {
              id: actual.entradaId,
              titularId: actual.usuarioId,
              estado: { in: ['GENERADA', 'ASIGNADA'] },
              accesos: { none: {} },
            },
            data: {
              estado: EntradaEstado.REEMBOLSADA,
              ticketPoolId: null,
            },
          });
          if (!actualizadoEntrada.count)
            throw new ConflictException(
              'La entrada ya no está disponible para reembolso.',
            );
          await tx.credencial.updateMany({
            where: { entradaId: actual.entradaId },
            data: { activa: false },
          });
          if (actual.entrada.ticketPoolId) {
            await tx.ticketPool.delete({
              where: { id: actual.entrada.ticketPoolId },
            });
            await completarPool(tx, actual.entrada.categoriaId, 1);
          }
        }
        return tx.reembolsoEntrada.update({
          where: { id },
          data: {
            estado,
            ...(estado === 'PAGADO'
              ? {
                  evidenciaUrl: stored!.url,
                  pagadoAt: new Date(),
                  pagadoPorId: adminId ?? null,
                }
              : {}),
          },
          include: {
            entrada: {
              select: {
                codigo: true,
                evento: { select: { titulo: true } },
              },
            },
            usuario: {
              select: { email: true, nombre: true, apellido: true },
            },
          },
        });
      });

      const correoEnviado = await this.notify(async () => {
        const nombre =
          [actualizado.usuario.nombre, actualizado.usuario.apellido]
            .filter(Boolean)
            .join(' ') || 'hola';
        await this.mail.sendReembolsoEntradaActualizado(
          actualizado.usuario.email,
          nombre,
          {
            evento: actualizado.entrada.evento.titulo,
            codigo: actualizado.entrada.codigo,
            estado,
            monto: actualizado.monto?.toFixed(2) ?? '0.00',
          },
        );
      });

      return { ...actualizado, correoEnviado };
    } catch (err) {
      if (stored?.publicId) await this.storage.remove(stored.publicId);
      throw err;
    }
  }

  private async notify(send: () => Promise<void>) {
    try {
      await send();
      return true;
    } catch (err) {
      this.logger.warn(
        `Correo de reembolso no enviado: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }
}
