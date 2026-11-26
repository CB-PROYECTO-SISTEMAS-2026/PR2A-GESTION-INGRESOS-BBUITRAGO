import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EventoEstado,
  SolicitudNegocio_estado,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import {
  RevisarSolicitudNegocioDto,
  SolicitarParticipacionDto,
} from './dto/businesses.dto';

const EVENTOS_SOLICITABLES: EventoEstado[] = [
  EventoEstado.BORRADOR,
  EventoEstado.PUBLICADO,
];

const ACTIVAS: SolicitudNegocio_estado[] = [
  SolicitudNegocio_estado.PENDIENTE,
  SolicitudNegocio_estado.ACEPTADA,
];

@Injectable()
export class SolicitudesNegocioService {
  private readonly logger = new Logger(SolicitudesNegocioService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  /** Eventos en los que el negocio aún puede pedir participar. */
  async eventosDisponibles(duenoId: string) {
    const negocio = await this.requireNegocio(duenoId);
    const ya = await this.prisma.solicitudNegocio.findMany({
      where: { negocioId: negocio.id, estado: { in: ACTIVAS } },
      select: { eventoId: true },
    });
    const ocupados = new Set(ya.map((s) => s.eventoId));
    const eventos = await this.prisma.evento.findMany({
      where: { estado: { in: EVENTOS_SOLICITABLES } },
      select: {
        id: true,
        titulo: true,
        estado: true,
        ubicacion: true,
        fechas: {
          orderBy: { fecha: 'asc' },
          select: { fecha: true },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return eventos
      .filter((e) => !ocupados.has(e.id))
      .map((e) => ({
        id: e.id,
        titulo: e.titulo,
        estado: e.estado,
        ubicacion: e.ubicacion,
        fechaInicio: e.fechas[0]?.fecha ?? null,
      }));
  }

  misSolicitudes(duenoId: string) {
    return this.prisma.solicitudNegocio.findMany({
      where: { negocio: { duenoId } },
      include: {
        evento: {
          select: {
            id: true,
            titulo: true,
            estado: true,
            ubicacion: true,
            fechas: {
              orderBy: { fecha: 'asc' },
              select: { fecha: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async solicitar(duenoId: string, dto: SolicitarParticipacionDto) {
    const negocio = await this.requireNegocio(duenoId);
    if (dto.negocioId && dto.negocioId !== negocio.id) {
      throw new ForbiddenException('No puedes solicitar con otro negocio.');
    }
    const evento = await this.prisma.evento.findUnique({
      where: { id: dto.eventoId },
      select: { id: true, titulo: true, estado: true },
    });
    if (!evento) throw new NotFoundException('El evento no existe.');
    if (!EVENTOS_SOLICITABLES.includes(evento.estado)) {
      throw new BadRequestException(
        'Solo puedes solicitar participación en eventos borrador o publicados.',
      );
    }
    const previa = await this.prisma.solicitudNegocio.findFirst({
      where: {
        negocioId: negocio.id,
        eventoId: evento.id,
        estado: { in: ACTIVAS },
      },
    });
    if (previa) {
      throw new ConflictException(
        previa.estado === SolicitudNegocio_estado.ACEPTADA
          ? 'Tu negocio ya está habilitado para vender en este evento.'
          : 'Ya tienes una solicitud pendiente para este evento.',
      );
    }
    return this.prisma.solicitudNegocio.create({
      data: {
        negocioId: negocio.id,
        eventoId: evento.id,
        mensaje: dto.mensaje?.trim() || null,
      },
      include: {
        evento: { select: { id: true, titulo: true, estado: true } },
        negocio: { select: { id: true, nombre: true } },
      },
    });
  }

  async cancelar(duenoId: string, id: string) {
    const solicitud = await this.prisma.solicitudNegocio.findFirst({
      where: { id, negocio: { duenoId } },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.estado !== SolicitudNegocio_estado.PENDIENTE) {
      throw new BadRequestException(
        'Solo puedes cancelar una solicitud que aún está pendiente.',
      );
    }
    return this.prisma.solicitudNegocio.update({
      where: { id },
      data: { estado: SolicitudNegocio_estado.CANCELADA },
    });
  }

  adminList(estado?: SolicitudNegocio_estado) {
    return this.prisma.solicitudNegocio.findMany({
      where: estado ? { estado } : undefined,
      include: {
        evento: { select: { id: true, titulo: true, estado: true } },
        negocio: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            dueno: {
              select: { id: true, nombre: true, apellido: true, email: true },
            },
          },
        },
        respondidoPor: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async revisar(
    adminId: string,
    id: string,
    dto: RevisarSolicitudNegocioDto,
  ) {
    const solicitud = await this.prisma.solicitudNegocio.findUnique({
      where: { id },
      include: {
        evento: { select: { id: true, titulo: true, estado: true } },
        negocio: {
          select: {
            id: true,
            nombre: true,
            dueno: {
              select: { id: true, email: true, nombre: true, apellido: true },
            },
          },
        },
      },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.estado !== SolicitudNegocio_estado.PENDIENTE) {
      throw new ConflictException('Esta solicitud ya fue respondida.');
    }
    if (
      dto.estado === SolicitudNegocio_estado.RECHAZADA &&
      !dto.respuesta?.trim()
    ) {
      throw new BadRequestException(
        'Indica el motivo del rechazo para que el negocio pueda corregirlo.',
      );
    }
    if (
      dto.estado === SolicitudNegocio_estado.ACEPTADA &&
      (solicitud.evento.estado === EventoEstado.FINALIZADO ||
        solicitud.evento.estado === EventoEstado.CANCELADO)
    ) {
      throw new BadRequestException(
        'No se puede aceptar la participación en un evento finalizado o cancelado.',
      );
    }

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const row = await tx.solicitudNegocio.update({
        where: { id },
        data: {
          estado: dto.estado,
          respuesta: dto.respuesta?.trim() || null,
          respondidoPorId: adminId,
          respondidoAt: new Date(),
        },
        include: {
          evento: { select: { id: true, titulo: true } },
          negocio: { select: { id: true, nombre: true } },
        },
      });
      // Mantiene el campo legacy alineado con la participación aceptada más reciente.
      if (dto.estado === SolicitudNegocio_estado.ACEPTADA) {
        await tx.negocio.update({
          where: { id: solicitud.negocioId },
          data: { eventoId: solicitud.eventoId },
        });
      }
      return row;
    });

    const correoEnviado = await this.notify(async () => {
      const dueno = solicitud.negocio.dueno;
      const nombre =
        [dueno.nombre, dueno.apellido].filter(Boolean).join(' ') || 'hola';
      await this.mail.sendParticipacionNegocioRevisada(dueno.email, nombre, {
        negocio: solicitud.negocio.nombre,
        evento: solicitud.evento.titulo,
        aceptada: dto.estado === SolicitudNegocio_estado.ACEPTADA,
        respuesta: dto.respuesta,
      });
    });

    return { ...actualizada, correoEnviado };
  }

  private async requireNegocio(duenoId: string) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { duenoId },
      select: { id: true, nombre: true },
    });
    if (!negocio) {
      throw new NotFoundException(
        'Primero crea tu negocio antes de solicitar participar en un evento.',
      );
    }
    return negocio;
  }

  private async notify(send: () => Promise<void>) {
    try {
      await send();
      return true;
    } catch (err) {
      this.logger.warn(
        `Correo de participación de negocio no enviado: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }
}
