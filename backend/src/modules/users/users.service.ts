import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntradaEstado, EventoEstado } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import {
  DATA_IN_USE_MESSAGE,
  assertIdentityAvailable,
  normalizeDocument,
  normalizePhone,
  rethrowUniqueViolation,
} from '../../common/security/user-identity';
import { dayToDate, todayIn } from '../events/event-schedule';
import { UpdateProfileDto } from './dto/update-profile.dto';

const MIN_BIRTH_DAY = '1900-01-01';

@Injectable()
export class UsersService {
  private readonly timeZone: string;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('APP_TIMEZONE', 'America/La_Paz');
  }

  async me(userId: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toPublic(user);
  }

  profile(userId: string) {
    return this.me(userId);
  }

  /**
   * Saldo del cliente en los eventos que se realizan hoy y para los que tiene una entrada válida.
   * Cada evento tiene su propio saldo y no se puede usar en otro evento.
   */
  async saldo(userId: string) {
    const today = dayToDate(todayIn(this.timeZone));
    const eventos = await this.prisma.evento.findMany({
      where: {
        estado: { in: [EventoEstado.PUBLICADO, EventoEstado.FINALIZADO] },
        fechas: { some: { fecha: today } },
        entradas: {
          some: {
            titularId: userId,
            estado: { notIn: [EntradaEstado.REEMBOLSADA, EntradaEstado.ANULADA] },
          },
        },
      },
      orderBy: { titulo: 'asc' },
      select: {
        id: true,
        titulo: true,
        saldos: { where: { usuarioId: userId }, select: { saldo: true } },
      },
    });
    return {
      eventos: eventos.map((e) => ({
        eventoId: e.id,
        titulo: e.titulo,
        saldo: (e.saldos[0]?.saldo ?? 0).toFixed(2),
      })),
    };
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const telefono = dto.telefono === undefined ? undefined : normalizePhone(dto.telefono);
    const documento = dto.documento === undefined ? undefined : normalizeDocument(dto.documento);
    await assertIdentityAvailable(this.prisma, { telefono, documento }, DATA_IN_USE_MESSAGE, userId);

    let fechaNac: Date | null | undefined;
    if (dto.fechaNac === null || dto.fechaNac === '') fechaNac = null;
    else if (dto.fechaNac !== undefined) {
      const day = dto.fechaNac.slice(0, 10);
      if (day < MIN_BIRTH_DAY || day > todayIn(this.timeZone)) {
        throw new BadRequestException('Ingresa una fecha de nacimiento válida.');
      }
      fechaNac = dayToDate(day);
    }

    const user = await this.prisma.usuario
      .update({
        where: { id: userId },
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          telefono,
          documento,
          fechaNac,
        },
        include: { roles: true },
      })
      .catch((err) => rethrowUniqueViolation(err, DATA_IN_USE_MESSAGE));
    return this.toPublic(user);
  }

  async updateFoto(userId: string, foto: Express.Multer.File | undefined) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const stored = await this.storage.upload(foto, 'usuarios', 'image');
    try {
      await this.prisma.usuario.update({
        where: { id: userId },
        data: { fotoUrl: stored.url, fotoPublicId: stored.publicId },
      });
    } catch (err) {
      await this.storage.remove(stored.publicId);
      throw err;
    }
    await this.storage.remove(user.fotoPublicId);
    return this.me(userId);
  }

  async removeFoto(userId: string) {
    const user = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.fotoPublicId || user.fotoUrl) {
      await this.prisma.usuario.update({ where: { id: userId }, data: { fotoUrl: null, fotoPublicId: null } });
      await this.storage.remove(user.fotoPublicId);
    }
    return this.me(userId);
  }

  private toPublic<T extends { passwordHash: string; fotoPublicId: string | null; roles: { role: string }[] }>(
    user: T,
  ) {
    const { passwordHash, fotoPublicId, ...rest } = user;
    return { ...rest, roles: user.roles.map((r) => r.role) };
  }
}
