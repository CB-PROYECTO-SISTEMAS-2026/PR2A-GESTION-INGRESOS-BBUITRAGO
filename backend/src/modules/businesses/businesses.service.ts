import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  AyudanteNegocio_estado,
  InvitacionEstado,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import {
  USER_EXISTS_FOR_OTHER_MESSAGE,
  assertIdentityAvailable,
  normalizeEmail,
  rethrowUniqueViolation,
} from '../../common/security/user-identity';
import {
  AsignarAyudanteDto,
  CreateAyudanteDto,
  CreateNegocioDto,
  CreateProductoDto,
  UpdateAyudanteDto,
  UpdateNegocioDto,
  UpdateProductoDto,
} from './dto/businesses.dto';

@Injectable()
export class BusinessesService {
  private readonly logger = new Logger(BusinessesService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async createNegocio(duenoId: string, dto: CreateNegocioDto) {
    // La participación en un evento se pide aparte (SolicitudNegocio). No usar eventoId aquí.
    return this.prisma.negocio
      .create({
        data: {
          duenoId,
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion?.trim() || null,
        },
        include: { productos: true, ayudantes: true },
      })
      .catch((err) =>
        // Negocio.duenoId es único: cada jefe de negocio tiene un solo negocio.
        rethrowUniqueViolation(err, 'Ya tienes un negocio registrado.'),
      );
  }

  misNegocios(duenoId: string) {
    return this.prisma.negocio.findMany({
      where: { duenoId },
      include: {
        // Solo activos: deleteProducto hace baja lógica (activo = false).
        productos: { where: { activo: true }, orderBy: { nombre: 'asc' } },
        ayudantes: {
          where: { activo: true },
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: {
              select: { id: true, email: true, nombre: true, apellido: true },
            },
          },
        },
        solicitudes: {
          select: {
            id: true,
            estado: true,
            mensaje: true,
            respuesta: true,
            createdAt: true,
            respondidoAt: true,
            evento: {
              select: { id: true, titulo: true, estado: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateNegocio(id: string, duenoId: string, dto: UpdateNegocioDto) {
    await this.ensureOwner(id, duenoId);
    return this.prisma.negocio.update({
      where: { id },
      data: {
        nombre: dto.nombre?.trim(),
        descripcion:
          dto.descripcion === undefined
            ? undefined
            : dto.descripcion.trim() || null,
      },
      include: {
        productos: true,
        ayudantes: true,
        solicitudes: {
          select: {
            id: true,
            estado: true,
            evento: { select: { id: true, titulo: true, estado: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async createProducto(
    negocioId: string,
    duenoId: string,
    dto: CreateProductoDto,
  ) {
    await this.ensureOwner(negocioId, duenoId);
    return this.prisma.producto.create({
      data: {
        negocioId,
        nombre: dto.nombre,
        precio: dto.precio,
        descripcion: dto.descripcion,
        stock: dto.stock ?? null,
        categoria: dto.categoria,
      },
    });
  }

  async updateProducto(id: string, duenoId: string, dto: UpdateProductoDto) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: { negocio: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (producto.negocio.duenoId !== duenoId) throw new ForbiddenException();
    return this.prisma.producto.update({ where: { id }, data: dto });
  }

  async deleteProducto(id: string, duenoId: string) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      include: { negocio: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    if (producto.negocio.duenoId !== duenoId) throw new ForbiddenException();
    // Baja lógica: el catálogo deja de mostrarlo; el historial de ventas conserva la referencia.
    await this.prisma.producto.update({
      where: { id },
      data: { activo: false },
    });
    return { message: 'Producto eliminado' };
  }

  async createAyudante(
    negocioId: string,
    jefeId: string,
    dto: CreateAyudanteDto,
  ) {
    const negocio = await this.ensureOwner(negocioId, jefeId);
    const email = normalizeEmail(dto.email);
    await assertIdentityAvailable(
      this.prisma,
      { email },
      USER_EXISTS_FOR_OTHER_MESSAGE,
    );
    const invitado = await this.prisma.invitacionUsuario.findFirst({
      where: {
        email,
        estado: InvitacionEstado.PENDIENTE,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (invitado) throw new ConflictException(USER_EXISTS_FOR_OTHER_MESSAGE);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const ayudante = await this.prisma
      .$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
          data: {
            email,
            passwordHash,
            nombre: dto.nombre.trim(),
            apellido: dto.apellido?.trim() || null,
            roles: { create: [{ role: Role.AYUDANTE }] },
          },
        });

        return tx.ayudanteNegocio.create({
          data: {
            negocioId,
            usuarioId: usuario.id,
            jefeId,
            // El jefe crea la cuenta con contraseña: no hay invitación pendiente.
            estado: AyudanteNegocio_estado.ACTIVO,
          },
          include: {
            usuario: {
              select: { id: true, email: true, nombre: true, apellido: true },
            },
            negocio: true,
          },
        });
      })
      .catch((err) =>
        rethrowUniqueViolation(err, USER_EXISTS_FOR_OTHER_MESSAGE),
      );

    const jefe = await this.prisma.usuario.findUnique({
      where: { id: jefeId },
      select: { nombre: true, apellido: true },
    });
    let correoEnviado = true;
    try {
      await this.mail.sendAyudanteBienvenida(
        ayudante.usuario.email,
        ayudante.usuario.nombre,
        {
          negocio: negocio.nombre,
          jefe:
            [jefe?.nombre, jefe?.apellido].filter(Boolean).join(' ') ||
            'Tu jefe de negocio',
        },
      );
    } catch (err) {
      correoEnviado = false;
      this.logger.warn(
        `Bienvenida de ayudante no enviada: ${(err as Error).message}`,
      );
    }
    return { ...ayudante, correoEnviado };
  }

  async asignarAyudante(
    ayudanteId: string,
    jefeId: string,
    dto: AsignarAyudanteDto,
  ) {
    const ayudante = await this.requireAyudanteDelJefe(ayudanteId, jefeId);
    await this.ensureOwner(dto.negocioId, jefeId);
    return this.prisma.ayudanteNegocio.update({
      where: { id: ayudante.id },
      data: { negocioId: dto.negocioId },
      include: {
        usuario: {
          select: { id: true, email: true, nombre: true, apellido: true },
        },
        negocio: true,
      },
    });
  }

  async updateAyudante(
    ayudanteId: string,
    jefeId: string,
    dto: UpdateAyudanteDto,
  ) {
    const ayudante = await this.requireAyudanteDelJefe(ayudanteId, jefeId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.nombre !== undefined || dto.apellido !== undefined) {
        await tx.usuario.update({
          where: { id: ayudante.usuarioId },
          data: {
            ...(dto.nombre !== undefined
              ? { nombre: dto.nombre.trim() }
              : {}),
            ...(dto.apellido !== undefined
              ? { apellido: dto.apellido.trim() || null }
              : {}),
          },
        });
      }
      return tx.ayudanteNegocio.update({
        where: { id: ayudante.id },
        data: {
          ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        },
        include: {
          usuario: {
            select: { id: true, email: true, nombre: true, apellido: true },
          },
        },
      });
    });
  }

  async deleteAyudante(ayudanteId: string, jefeId: string) {
    const ayudante = await this.requireAyudanteDelJefe(ayudanteId, jefeId);
    // Baja lógica: deja de aparecer en el panel y no puede cobrar en el POS.
    await this.prisma.ayudanteNegocio.update({
      where: { id: ayudante.id },
      data: { activo: false, estado: AyudanteNegocio_estado.INACTIVO },
    });
    return { message: 'Ayudante eliminado' };
  }

  private async requireAyudanteDelJefe(ayudanteId: string, jefeId: string) {
    const ayudante = await this.prisma.ayudanteNegocio.findUnique({
      where: { id: ayudanteId },
    });
    if (!ayudante || !ayudante.activo) {
      throw new NotFoundException('Ayudante no encontrado');
    }
    if (ayudante.jefeId !== jefeId) throw new ForbiddenException();
    return ayudante;
  }

  private async ensureOwner(negocioId: string, duenoId: string) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { id: negocioId },
    });
    if (!negocio) throw new NotFoundException('Negocio no encontrado');
    if (negocio.duenoId !== duenoId)
      throw new ForbiddenException('No eres dueño de este negocio');
    return negocio;
  }
}
