import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventoEstado, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESO_CON_MANILLA } from '../entradas/entradas-emision';
import {
  AsignarSupervisorDto,
  CandidatosSupervisorQuery,
  CreatePuntoRetiroDto,
  UpdatePuntoRetiroDto,
} from './dto/manillas.dto';
import { entregaSelect, nombreCompleto, presentarEntrega } from './manillas-helpers';

const MAX_CANDIDATOS = 20;
const MAX_ENTREGAS = 200;
const EVENTO_CERRADO: EventoEstado[] = [EventoEstado.FINALIZADO, EventoEstado.CANCELADO];

/**
 * HU-053 (administración): puntos físicos de entrega de manillas de un evento y los supervisores
 * (rol ENCARGADO_ACCESO) que atienden cada punto.
 */
@Injectable()
export class PuntosRetiroService {
  constructor(private prisma: PrismaService) {}

  async listar(eventoId: string) {
    const evento = await this.requireEvento(eventoId);
    const puntos = await this.prisma.puntoRetiroManilla.findMany({
      where: { eventoId },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        ubicacion: true,
        horario: true,
        activo: true,
        supervisores: {
          where: { activo: true },
          orderBy: { createdAt: 'asc' },
          select: { usuario: { select: { id: true, nombre: true, apellido: true, email: true, activo: true } } },
        },
        _count: { select: { manillas: { where: { vinculada: true } } } },
      },
    });
    return {
      evento: {
        id: evento.id,
        titulo: evento.titulo,
        estado: evento.estado,
        tipoAcceso: evento.tipoAcceso,
        usaManilla: ACCESO_CON_MANILLA.includes(evento.tipoAcceso),
      },
      puntos: puntos.map(({ supervisores, _count, ...p }) => ({
        ...p,
        manillasEntregadas: _count.manillas,
        supervisores: supervisores.map(({ usuario }) => ({
          id: usuario.id,
          nombre: nombreCompleto(usuario),
          email: usuario.email,
          activo: usuario.activo,
        })),
      })),
    };
  }

  async crear(eventoId: string, dto: CreatePuntoRetiroDto) {
    const evento = await this.requireEvento(eventoId);
    if (!ACCESO_CON_MANILLA.includes(evento.tipoAcceso)) {
      throw new BadRequestException(
        'Este evento usa QR digital: el QR se asigna al perfil del usuario y no requiere puntos de entrega de manillas.',
      );
    }
    if (EVENTO_CERRADO.includes(evento.estado)) {
      throw new BadRequestException('No se pueden agregar puntos de entrega a un evento finalizado o cancelado.');
    }
    await this.ensureNombreLibre(eventoId, dto.nombre);
    await this.prisma.puntoRetiroManilla.create({
      data: { eventoId, nombre: dto.nombre, ubicacion: dto.ubicacion || null, horario: dto.horario || null },
    });
    return this.listar(eventoId);
  }

  async actualizar(id: string, dto: UpdatePuntoRetiroDto) {
    const punto = await this.requirePunto(id);
    if (dto.nombre !== undefined) await this.ensureNombreLibre(punto.eventoId, dto.nombre, id);
    await this.prisma.puntoRetiroManilla.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        activo: dto.activo,
        ...(dto.ubicacion !== undefined ? { ubicacion: dto.ubicacion || null } : {}),
        ...(dto.horario !== undefined ? { horario: dto.horario || null } : {}),
      },
    });
    return this.listar(punto.eventoId);
  }

  async eliminar(id: string) {
    const punto = await this.prisma.puntoRetiroManilla.findUnique({
      where: { id },
      select: { eventoId: true, _count: { select: { manillas: true } } },
    });
    if (!punto) throw new NotFoundException('Punto de entrega no encontrado');
    if (punto._count.manillas > 0) {
      throw new ConflictException(
        'Este punto ya registró entregas de manillas y debe conservarse en el historial. Desactívalo para que no se use más.',
      );
    }
    await this.prisma.puntoRetiroManilla.delete({ where: { id } });
    return this.listar(punto.eventoId);
  }

  /** Usuarios activos con rol ENCARGADO_ACCESO que todavía no atienden este punto. */
  async candidatos(puntoId: string, query: CandidatosSupervisorQuery) {
    await this.requirePunto(puntoId);
    const q = query.q?.trim();
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        activo: true,
        eliminadoAt: null,
        roles: { some: { role: Role.ENCARGADO_ACCESO } },
        puntosRetiroAsignados: { none: { puntoRetiroId: puntoId, activo: true } },
        ...(q
          ? { OR: [{ nombre: { contains: q } }, { apellido: { contains: q } }, { email: { contains: q } }] }
          : {}),
      },
      orderBy: { nombre: 'asc' },
      take: MAX_CANDIDATOS,
      select: { id: true, nombre: true, apellido: true, email: true },
    });
    return { candidatos: usuarios.map((u) => ({ id: u.id, nombre: nombreCompleto(u), email: u.email })) };
  }

  async asignarSupervisor(puntoId: string, dto: AsignarSupervisorDto) {
    const punto = await this.requirePunto(puntoId);
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: dto.usuarioId },
      select: {
        activo: true,
        eliminadoAt: true,
        roles: { where: { role: Role.ENCARGADO_ACCESO }, select: { id: true } },
      },
    });
    if (!usuario || !usuario.activo || usuario.eliminadoAt) {
      throw new NotFoundException('Usuario no encontrado o inactivo.');
    }
    if (!usuario.roles.length) {
      throw new BadRequestException('Solo se pueden asignar usuarios con el rol Encargado de acceso (supervisor).');
    }
    // Si ya atendió el punto y se le quitó, se reactiva la misma fila.
    await this.prisma.supervisorPuntoRetiro.upsert({
      where: { puntoRetiroId_usuarioId: { puntoRetiroId: puntoId, usuarioId: dto.usuarioId } },
      create: { puntoRetiroId: puntoId, usuarioId: dto.usuarioId },
      update: { activo: true },
    });
    return this.listar(punto.eventoId);
  }

  async quitarSupervisor(puntoId: string, usuarioId: string) {
    const punto = await this.requirePunto(puntoId);
    const { count } = await this.prisma.supervisorPuntoRetiro.updateMany({
      where: { puntoRetiroId: puntoId, usuarioId, activo: true },
      data: { activo: false },
    });
    if (!count) throw new NotFoundException('El supervisor no está asignado a este punto.');
    return this.listar(punto.eventoId);
  }

  /** Registro de manillas entregadas en el evento: punto, supervisor y cliente de cada una. */
  async entregas(eventoId: string) {
    await this.requireEvento(eventoId);
    const where = { eventoId, vinculada: true };
    const [total, manillas] = await Promise.all([
      this.prisma.manilla.count({ where }),
      this.prisma.manilla.findMany({
        where,
        orderBy: { vinculadaAt: 'desc' },
        take: MAX_ENTREGAS,
        select: entregaSelect,
      }),
    ]);
    return { total, entregas: manillas.map(presentarEntrega) };
  }

  private async ensureNombreLibre(eventoId: string, nombre: string, exceptId?: string) {
    const key = nombre.trim().toLocaleLowerCase('es');
    const puntos = await this.prisma.puntoRetiroManilla.findMany({
      where: { eventoId, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { nombre: true },
    });
    if (puntos.some((p) => p.nombre.trim().toLocaleLowerCase('es') === key)) {
      throw new ConflictException(`Ya existe un punto de entrega llamado "${nombre.trim()}" en este evento.`);
    }
  }

  private async requireEvento(eventoId: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: { id: true, titulo: true, estado: true, tipoAcceso: true },
    });
    if (!evento) throw new NotFoundException('Evento no encontrado');
    return evento;
  }

  private async requirePunto(id: string) {
    const punto = await this.prisma.puntoRetiroManilla.findUnique({ where: { id }, select: { id: true, eventoId: true } });
    if (!punto) throw new NotFoundException('Punto de entrega no encontrado');
    return punto;
  }
}
