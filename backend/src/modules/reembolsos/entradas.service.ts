import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReembolsoEstado } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReembolsoEntradasService {
  constructor(private db: PrismaService) {}

  listar(usuarioId: string | undefined, page: number) {
    return this.db.reembolsoEntrada.findMany({
      where: { usuarioId },
      include: {
        entrada: { select: { codigo: true, evento: { select: { titulo: true } } } },
        usuario: { select: { nombre: true, apellido: true } },
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
        evento: { select: { estado: true } },
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
    if (entrada.evento.estado !== 'CANCELADO' && entrada.compra.reembolsoHasta && new Date() > entrada.compra.reembolsoHasta)
      throw new BadRequestException('Venció el plazo de reembolso informado al comprar la entrada.');
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
      if (!(
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ))
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

  async resolver(id: string, estado: Exclude<ReembolsoEstado, 'SOLICITADO'>) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM ReembolsoEntrada WHERE id = ${id} FOR UPDATE`,
      );
      const actual = await tx.reembolsoEntrada.findUnique({ where: { id } });
      if (!actual) throw new NotFoundException('Solicitud no encontrada.');
      if (actual.estado === estado) return actual;
      if (actual.estado !== (estado === 'PAGADO' ? 'APROBADO' : 'SOLICITADO'))
        throw new ConflictException('Transición de estado inválida.');
      if (estado === 'APROBADO') {
        const actualizado = await tx.entrada.updateMany({
          where: {
            id: actual.entradaId,
            titularId: actual.usuarioId,
            estado: { in: ['GENERADA', 'ASIGNADA'] },
            accesos: { none: {} },
          },
          data: { estado: 'REEMBOLSADA' },
        });
        if (!actualizado.count)
          throw new ConflictException(
            'La entrada ya no está disponible para reembolso.',
          );
        await tx.credencial.updateMany({
          where: { entradaId: actual.entradaId },
          data: { activa: false },
        });
      }
      return tx.reembolsoEntrada.update({ where: { id }, data: { estado } });
    });
  }
}
