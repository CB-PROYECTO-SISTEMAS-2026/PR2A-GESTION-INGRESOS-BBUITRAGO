import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventoEstado } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { nombreCompleto } from '../pos/pos-helpers';
import {
  AsignarPersonalDto,
  CandidatosPersonalDto,
} from './dto/personal-evento.dto';

const MAX_CANDIDATOS = 20;

/** Eventos donde ya no tiene sentido asignar personal. */
const EVENTO_CERRADO: EventoEstado[] = [
  EventoEstado.FINALIZADO,
  EventoEstado.CANCELADO,
];

/**
 * Personal asignado a cada evento (StaffEvento): el administrador elige qué usuarios con rol de
 * personal (p. ej. RECARGADOR) trabajan en qué evento. Quitar a alguien lo desactiva y conserva
 * la fila, porque sus operaciones pasadas siguen apuntando a él.
 */
@Injectable()
export class PersonalEventoService {
  constructor(private prisma: PrismaService) {}

  async listar(eventoId: string) {
    await this.requireEvento(eventoId);
    const personal = await this.prisma.staffEvento.findMany({
      where: { eventoId, activo: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        createdAt: true,
        usuario: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
            activo: true,
          },
        },
      },
    });
    return {
      personal: personal.map((p) => ({
        id: p.id,
        role: p.role,
        asignadoAt: p.createdAt,
        usuario: {
          id: p.usuario.id,
          nombre: nombreCompleto(p.usuario) ?? '',
          email: p.usuario.email,
          telefono: p.usuario.telefono,
          activo: p.usuario.activo,
        },
      })),
    };
  }

  /** Usuarios activos con el rol pedido que todavía no están asignados al evento con ese rol. */
  async candidatos(eventoId: string, dto: CandidatosPersonalDto) {
    await this.requireEvento(eventoId);
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        activo: true,
        eliminadoAt: null,
        roles: { some: { role: dto.role } },
        staffAsignaciones: {
          none: { eventoId, role: dto.role, activo: true },
        },
        ...(dto.q
          ? {
              OR: [
                { nombre: { contains: dto.q } },
                { apellido: { contains: dto.q } },
                { email: { contains: dto.q } },
              ],
            }
          : {}),
      },
      orderBy: { nombre: 'asc' },
      take: MAX_CANDIDATOS,
      select: { id: true, nombre: true, apellido: true, email: true },
    });
    return {
      candidatos: usuarios.map((u) => ({
        id: u.id,
        nombre: nombreCompleto(u) ?? '',
        email: u.email,
      })),
    };
  }

  async asignar(eventoId: string, dto: AsignarPersonalDto) {
    const [evento, usuario] = await Promise.all([
      this.requireEvento(eventoId),
      this.prisma.usuario.findUnique({
        where: { id: dto.usuarioId },
        select: {
          activo: true,
          eliminadoAt: true,
          roles: { where: { role: dto.role }, select: { id: true } },
        },
      }),
    ]);
    if (EVENTO_CERRADO.includes(evento.estado)) {
      throw new BadRequestException(
        'No se puede asignar personal a un evento finalizado o cancelado.',
      );
    }
    if (!usuario || !usuario.activo || usuario.eliminadoAt) {
      throw new NotFoundException('Usuario no encontrado o inactivo.');
    }
    if (!usuario.roles.length) {
      throw new BadRequestException(
        'El usuario no tiene el rol que se quiere asignar.',
      );
    }

    // Si ya estuvo asignado y se le quitó, se reactiva la misma fila.
    await this.prisma.staffEvento.upsert({
      where: {
        usuarioId_eventoId_role: {
          usuarioId: dto.usuarioId,
          eventoId,
          role: dto.role,
        },
      },
      create: { usuarioId: dto.usuarioId, eventoId, role: dto.role },
      update: { activo: true },
    });
    return this.listar(eventoId);
  }

  async quitar(eventoId: string, asignacionId: string) {
    const { count } = await this.prisma.staffEvento.updateMany({
      where: { id: asignacionId, eventoId, activo: true },
      data: { activo: false },
    });
    if (!count) throw new NotFoundException('Asignación no encontrada.');
    return this.listar(eventoId);
  }

  private async requireEvento(eventoId: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: { id: true, estado: true },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    return evento;
  }
}
