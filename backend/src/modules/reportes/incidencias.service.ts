import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IncidenciasEventoService {
  constructor(private db: PrismaService) {}
  async registrar(
    eventoId: string,
    autorId: string,
    clave: string,
    descripcion: string,
  ) {
    const where = { eventoId_autorId_clave: { eventoId, autorId, clave } };
    try {
      return await this.db.incidenciaEvento.create({
        data: { eventoId, autorId, clave, descripcion },
      });
    } catch (e) {
      if (e?.code !== 'P2002') throw e;
      const previa = await this.db.incidenciaEvento.findUniqueOrThrow({
        where,
      });
      if (previa.descripcion !== descripcion)
        throw new ConflictException(
          'La clave ya corresponde a otra incidencia.',
        );
      return previa;
    }
  }
  listar(eventoId: string, page: number) {
    return this.db.incidenciaEvento.findMany({
      where: { eventoId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 50,
      take: 50,
    });
  }
  async resolver(
    eventoId: string,
    id: string,
    adminId: string,
    resolucion: string,
  ) {
    await this.db.incidenciaEvento.updateMany({
      where: { id, eventoId, resueltaAt: null },
      data: { resolucion, resueltaAt: new Date(), resueltaPorId: adminId },
    });
    const fila = await this.db.incidenciaEvento.findFirst({
      where: { id, eventoId },
    });
    if (!fila) throw new NotFoundException('Incidencia no encontrada.');
    if (fila.resolucion !== resolucion || fila.resueltaPorId !== adminId)
      throw new ConflictException('La incidencia ya fue resuelta.');
    return fila;
  }
}
