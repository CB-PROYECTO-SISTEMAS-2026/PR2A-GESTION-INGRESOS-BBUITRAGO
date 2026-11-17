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
  SolicitudNegocio_estado,
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
    await this.ensureEventoExiste(dto.eventoId);
    return this.prisma.negocio
      .create({
        data: {
          duenoId,
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion?.trim() || null,
          eventoId: dto.eventoId || null,
        },
        include: { productos: true, ayudantes: true },
      })
      .catch((err) =>
        // Negocio.duenoId es único: cada jefe de negocio tiene un solo negocio.
        rethrowUniqueViolation(err, 'Ya tienes un negocio registrado.'),
      );
  }

  private async ensureEventoExiste(eventoId?: string) {
    if (!eventoId) return;
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: { id: true },
    });
    if (!evento)
      throw new NotFoundException('El evento seleccionado no existe');
  }

  misNegocios(duenoId: string) {
    return this.prisma.negocio.findMany({
      where: { duenoId },
      include: {
        // Los productos con ventas no se borran, se desactivan (ver deleteProducto).
        productos: { where: { activo: true }, orderBy: { nombre: 'asc' } },
        ayudantes: {
          include: {
            usuario: {
              select: { id: true, email: true, nombre: true, apellido: true },
            },
          },
        },
        evento: { select: { id: true, titulo: true } },
        solicitudes: {
          where: { estado: SolicitudNegocio_estado.ACEPTADA },
          select: { evento: { select: { id: true, titulo: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateNegocio(id: string, duenoId: string, dto: UpdateNegocioDto) {
    await this.ensureOwner(id, duenoId);
    await this.ensureEventoExiste(dto.eventoId);
    return this.prisma.negocio.update({
      where: { id },
      data: {
        nombre: dto.nombre?.trim(),
        descripcion:
          dto.descripcion === undefined
            ? undefined
            : dto.descripcion.trim() || null,
        eventoId: dto.eventoId === undefined ? undefined : dto.eventoId || null,
      },
      include: { productos: true, ayudantes: true },
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
    // Un producto ya vendido sigue referenciado por el detalle de las ventas: se desactiva.
    const vendido = await this.prisma.detalleVenta.count({
      where: { productoId: id },
    });
    if (vendido) {
      await this.prisma.producto.update({
        where: { id },
        data: { activo: false },
      });
    } else {
      await this.prisma.producto.delete({ where: { id } });
    }
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
            rolFuncion: dto.rolFuncion?.trim() || 'cajero',
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
    const ayudante = await this.prisma.ayudanteNegocio.findUnique({
      where: { id: ayudanteId },
    });
    if (!ayudante) throw new NotFoundException('Ayudante no encontrado');
    if (ayudante.jefeId !== jefeId) throw new ForbiddenException();
    await this.ensureOwner(dto.negocioId, jefeId);
    return this.prisma.ayudanteNegocio.update({
      where: { id: ayudanteId },
      data: { negocioId: dto.negocioId },
      include: {
        usuario: { select: { id: true, email: true, nombre: true } },
        negocio: true,
      },
    });
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
