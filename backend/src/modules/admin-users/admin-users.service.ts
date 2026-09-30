import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvitacionEstado, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { generateToken, hashToken } from '../../common/security/tokens';
import {
  USER_EXISTS_FOR_OTHER_MESSAGE,
  USER_EXISTS_MESSAGE,
  assertIdentityAvailable,
  normalizePhone,
  rethrowUniqueViolation,
} from '../../common/security/user-identity';
import { AuthService } from '../auth/auth.service';
import { AceptarInvitacionDto, CreateInvitacionDto, ListUsuariosQuery } from './dto/admin-users.dto';

const INVITATION_HOURS = 72;
const USUARIOS_POR_PAGINA = 20;
/** Registros recientes por sección en el detalle de un usuario. */
const RECIENTES = 5;

const invitacionPublicSelect = {
  id: true,
  email: true,
  nombre: true,
  apellido: true,
  telefono: true,
  role: true,
  estado: true,
  expiresAt: true,
  aceptadaAt: true,
  createdAt: true,
  creadoPor: { select: { id: true, nombre: true, apellido: true, email: true } },
} satisfies Prisma.InvitacionUsuarioSelect;

@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private auth: AuthService,
  ) {}

  async listUsuarios(query: ListUsuariosQuery) {
    const words = (query.q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
    const where: Prisma.UsuarioWhereInput = {
      eliminadoAt: null,
      ...(query.role ? { roles: { some: { role: query.role } } } : {}),
      // Cada palabra debe coincidir con el nombre, el apellido o el correo (p. ej. "maría quispe").
      AND: words.map((w) => ({
        OR: [{ nombre: { contains: w } }, { apellido: { contains: w } }, { email: { contains: w } }],
      })),
    };
    const total = await this.prisma.usuario.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / USUARIOS_POR_PAGINA));
    const page = Math.min(query.page ?? 1, totalPages);
    const users = await this.prisma.usuario.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * USUARIOS_POR_PAGINA,
      take: USUARIOS_POR_PAGINA,
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        activo: true,
        createdAt: true,
        roles: { select: { role: true } },
      },
    });
    return {
      items: users.map((u) => ({ ...u, roles: u.roles.map((r) => r.role) })),
      total,
      page,
      pageSize: USUARIOS_POR_PAGINA,
      totalPages,
    };
  }

  async getUsuario(id: string) {
    const user = await this.prisma.usuario.findFirst({
      where: { id, eliminadoAt: null },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        documento: true,
        fechaNac: true,
        fotoUrl: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { role: true } },
        ayudanteDe: {
          select: {
            rolFuncion: true,
            activo: true,
            negocio: { select: { nombre: true, evento: { select: { titulo: true } } } },
            jefe: { select: { nombre: true, apellido: true } },
          },
        },
        compras: {
          orderBy: { createdAt: 'desc' },
          take: RECIENTES,
          select: {
            id: true,
            estado: true,
            montoTotal: true,
            createdAt: true,
            evento: { select: { titulo: true } },
          },
        },
        entradas: {
          orderBy: { createdAt: 'desc' },
          take: RECIENTES,
          select: {
            id: true,
            codigo: true,
            estado: true,
            evento: { select: { titulo: true } },
            categoria: { select: { nombre: true } },
          },
        },
        solicitudes: {
          orderBy: { createdAt: 'desc' },
          take: RECIENTES,
          select: { id: true, nombreEvento: true, estado: true, fechaInicio: true, createdAt: true },
        },
        eventosOrganizados: {
          orderBy: { createdAt: 'desc' },
          take: RECIENTES,
          select: { id: true, titulo: true, estado: true, fechas: { select: { fecha: true }, orderBy: { fecha: 'asc' }, take: 1 } },
        },
        negocios: {
          orderBy: { createdAt: 'desc' },
          take: RECIENTES,
          select: {
            id: true,
            nombre: true,
            activo: true,
            evento: { select: { titulo: true } },
            _count: { select: { productos: true, ayudantes: true } },
          },
        },
        _count: {
          select: {
            solicitudes: true,
            eventosOrganizados: true,
            negocios: true,
            compras: true,
            entradas: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return { ...user, roles: user.roles.map((r) => r.role) };
  }

  /**
   * Baja definitiva de la cuenta: deja de poder ingresar y sus datos de contacto se liberan.
   * La fila se conserva porque eventos, solicitudes y compras la referencian.
   */
  async eliminarUsuario(adminId: string, id: string) {
    if (id === adminId) throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    const user = await this.prisma.usuario.findFirst({
      where: { id, eliminadoAt: null },
      include: { roles: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.roles.some((r) => r.role === Role.ADMIN)) {
      const otrosAdmins = await this.prisma.usuario.count({
        where: { id: { not: id }, activo: true, eliminadoAt: null, roles: { some: { role: Role.ADMIN } } },
      });
      if (!otrosAdmins) throw new BadRequestException('No puedes eliminar al único administrador activo.');
    }

    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id },
        data: {
          activo: false,
          eliminadoAt: new Date(),
          email: `eliminado.${id}@eventix.invalid`,
          telefono: null,
          documento: null,
          passwordHash: await bcrypt.hash(generateToken().token, 10),
        },
      }),
      this.prisma.usuarioRol.deleteMany({ where: { usuarioId: id } }),
      this.prisma.passwordResetToken.deleteMany({ where: { usuarioId: id } }),
      this.prisma.staffEvento.updateMany({ where: { usuarioId: id }, data: { activo: false } }),
      this.prisma.ayudanteNegocio.updateMany({ where: { usuarioId: id }, data: { activo: false } }),
    ]);
    return { message: 'Usuario eliminado' };
  }

  async listInvitaciones(estado?: InvitacionEstado) {
    const items = await this.prisma.invitacionUsuario.findMany({
      where: estado ? { estado } : undefined,
      orderBy: { createdAt: 'desc' },
      select: invitacionPublicSelect,
    });
    const now = new Date();
    return items.map((i) => ({
      ...i,
      expirada: i.estado === InvitacionEstado.PENDIENTE && i.expiresAt < now,
    }));
  }

  async createInvitacion(adminId: string, dto: CreateInvitacionDto) {
    const email = this.auth.normalizeEmail(dto.email);
    const telefono = normalizePhone(dto.telefono);
    await assertIdentityAvailable(this.prisma, { email, telefono }, USER_EXISTS_FOR_OTHER_MESSAGE);

    const pendientes = await this.prisma.invitacionUsuario.findMany({
      where: {
        estado: InvitacionEstado.PENDIENTE,
        OR: telefono ? [{ email }, { telefono }] : [{ email }],
      },
      select: { id: true, expiresAt: true },
    });
    const now = new Date();
    if (pendientes.some((p) => p.expiresAt > now)) {
      throw new ConflictException(
        'Ya hay una invitación pendiente para este usuario. Puedes reenviarla o cancelarla.',
      );
    }
    if (pendientes.length) {
      await this.prisma.invitacionUsuario.updateMany({
        where: { id: { in: pendientes.map((p) => p.id) } },
        data: { estado: InvitacionEstado.CANCELADA },
      });
    }

    const { token, tokenHash } = generateToken();
    const invitacion = await this.prisma.invitacionUsuario.create({
      data: {
        email,
        nombre: dto.nombre.trim(),
        apellido: dto.apellido?.trim() || null,
        telefono,
        role: dto.role,
        tokenHash,
        expiresAt: this.expiry(),
        creadoPorId: adminId,
      },
      select: invitacionPublicSelect,
    });

    try {
      await this.mail.sendInvitation(email, invitacion.nombre, invitacion.role, token, INVITATION_HOURS);
    } catch (err) {
      await this.prisma.invitacionUsuario.delete({ where: { id: invitacion.id } });
      throw err;
    }
    return invitacion;
  }

  async reenviar(id: string) {
    const invitacion = await this.findPending(id);
    await assertIdentityAvailable(
      this.prisma,
      { email: invitacion.email, telefono: invitacion.telefono },
      USER_EXISTS_FOR_OTHER_MESSAGE,
    );

    const previous = { tokenHash: invitacion.tokenHash, expiresAt: invitacion.expiresAt };
    const { token, tokenHash } = generateToken();
    const updated = await this.prisma.invitacionUsuario.update({
      where: { id },
      data: { tokenHash, expiresAt: this.expiry() },
      select: invitacionPublicSelect,
    });
    try {
      await this.mail.sendInvitation(updated.email, updated.nombre, updated.role, token, INVITATION_HOURS);
    } catch (err) {
      await this.prisma.invitacionUsuario.update({ where: { id }, data: previous });
      throw err;
    }
    return updated;
  }

  async cancelar(id: string) {
    await this.findPending(id);
    return this.prisma.invitacionUsuario.update({
      where: { id },
      data: { estado: InvitacionEstado.CANCELADA },
      select: invitacionPublicSelect,
    });
  }

  async verificarToken(token: string) {
    const invitacion = await this.findValidByToken(token);
    await assertIdentityAvailable(this.prisma, {
      email: invitacion.email,
      telefono: invitacion.telefono,
    });
    return {
      email: invitacion.email,
      nombre: invitacion.nombre,
      apellido: invitacion.apellido,
      telefono: invitacion.telefono,
      role: invitacion.role,
      expiresAt: invitacion.expiresAt,
    };
  }

  async aceptar(dto: AceptarInvitacionDto) {
    const invitacion = await this.findValidByToken(dto.token);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const telefono = normalizePhone(invitacion.telefono);

    const user = await this.prisma
      .$transaction(async (tx) => {
        const claimed = await tx.invitacionUsuario.updateMany({
          where: { id: invitacion.id, estado: InvitacionEstado.PENDIENTE },
          data: { estado: InvitacionEstado.ACEPTADA, aceptadaAt: new Date() },
        });
        if (claimed.count !== 1) throw new BadRequestException('La invitación ya fue utilizada.');

        await assertIdentityAvailable(tx, { email: invitacion.email, telefono }, USER_EXISTS_MESSAGE);

        return tx.usuario.create({
          data: {
            email: invitacion.email,
            passwordHash,
            nombre: invitacion.nombre,
            apellido: invitacion.apellido,
            telefono,
            roles: { create: [{ role: invitacion.role }] },
          },
          include: { roles: true },
        });
      })
      .catch((err) => rethrowUniqueViolation(err));

    return this.auth.issueSession(user);
  }

  private expiry() {
    return new Date(Date.now() + INVITATION_HOURS * 60 * 60 * 1000);
  }

  private async findPending(id: string) {
    const invitacion = await this.prisma.invitacionUsuario.findUnique({ where: { id } });
    if (!invitacion) throw new NotFoundException('Invitación no encontrada');
    if (invitacion.estado !== InvitacionEstado.PENDIENTE) {
      throw new BadRequestException('Solo se pueden modificar invitaciones pendientes.');
    }
    return invitacion;
  }

  private async findValidByToken(token: string) {
    const invitacion = await this.prisma.invitacionUsuario.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!invitacion || invitacion.estado !== InvitacionEstado.PENDIENTE) {
      throw new BadRequestException('La invitación no es válida o ya fue utilizada.');
    }
    if (invitacion.expiresAt < new Date()) {
      throw new BadRequestException('La invitación expiró. Pide al administrador que te la reenvíe.');
    }
    return invitacion;
  }
}
