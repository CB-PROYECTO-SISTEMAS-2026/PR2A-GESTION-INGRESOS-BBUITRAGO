import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CodigoClienteService } from '../saldo/codigo-cliente.service';
import { StorageService } from '../../common/storage/storage.service';

@Injectable()
export class IdentidadService {
  constructor(
    private db: PrismaService,
    private codigos: CodigoClienteService,
    private storage: StorageService,
  ) {}

  private async asignacion(operadorId: string, eventoId: string) {
    const staff = await this.db.staffEvento.findFirst({
      where: {
        usuarioId: operadorId,
        eventoId,
        activo: true,
        role: 'DEVOLUCIONES',
      },
      select: { id: true },
    });
    if (!staff) throw new ForbiddenException('No tienes asignado este evento.');
  }

  async consultar(operadorId: string, eventoId: string, codigo: string) {
    await this.asignacion(operadorId, eventoId);
    const cliente = await this.codigos.resolver(eventoId, codigo);
    const [foto, movimientos] = await Promise.all([
      this.db.accesoEvento.findFirst({
        where: {
          eventoId,
          entradaId: cliente.entradaId,
          tipo: 'INGRESO',
          fotoIngresoUrl: { not: null },
        },
        orderBy: { createdAt: 'asc' },
        select: { fotoIngresoUrl: true, createdAt: true },
      }),
      this.db.transaccionSaldo.findMany({
        where: { eventoId, usuarioId: cliente.usuarioId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: { tipo: true, monto: true, estado: true, createdAt: true },
      }),
    ]);
    return {
      nombre: cliente.nombre,
      fotoIngreso: foto?.fotoIngresoUrl
        ? { url: foto.fotoIngresoUrl, tomadaAt: foto.createdAt }
        : null,
      movimientos,
    };
  }

  async comprobante(
    operadorId: string,
    id: string,
    archivo?: Express.Multer.File,
  ) {
    const where = {
      id,
      operadorId,
      tipo: 'DEVOLUCION' as const,
      estado: 'COMPLETADA' as const,
    };
    const operacion = await this.db.transaccionSaldo.findFirst({
      where,
      select: { eventoId: true, evidenciaUrl: true },
    });
    if (!operacion) throw new NotFoundException('Devolución no encontrada.');
    await this.asignacion(operadorId, operacion.eventoId);
    if (!archivo)
      throw new BadRequestException('Adjunta una foto del comprobante.');
    const huella = createHash('sha256').update(archivo.buffer).digest('hex');
    const carpeta = 'comprobantes-devolucion/' + huella;
    const existente = (url: string | null) => {
      if (url?.includes('/' + carpeta + '/')) return { id, evidenciaUrl: url };
      throw new ConflictException('La devolución ya tiene otro comprobante.');
    };
    if (operacion.evidenciaUrl) return existente(operacion.evidenciaUrl);
    const foto = await this.storage.upload(archivo, carpeta, 'image');
    const cambio = await this.db.transaccionSaldo.updateMany({
      where: { ...where, evidenciaUrl: null }, data: { evidenciaUrl: foto.url },
    });
    if (!cambio.count) {
      await this.storage.remove(foto.publicId);
      const previa = await this.db.transaccionSaldo.findFirstOrThrow({ where, select: { evidenciaUrl: true } });
      return existente(previa.evidenciaUrl);
    }
    return { id, evidenciaUrl: foto.url };
  }
}
