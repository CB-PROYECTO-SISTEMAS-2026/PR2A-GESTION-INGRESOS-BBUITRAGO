import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { generateToken, hashToken } from '../../common/security/tokens';
import {
  assertIdentityAvailable,
  normalizeEmail,
  normalizePhone,
  rethrowUniqueViolation,
} from '../../common/security/user-identity';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const RESET_TOKEN_MINUTES = 60;
const FORGOT_PASSWORD_MESSAGE =
  'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';

type SessionUser = {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  fotoUrl?: string | null;
  roles: { role: Role }[];
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  normalizeEmail(email: string) {
    return normalizeEmail(email);
  }

  issueSession(user: SessionUser) {
    return { accessToken: this.sign(user), user: this.sanitize(user) };
  }

  private sanitize(user: SessionUser) {
    return {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono,
      fotoUrl: user.fotoUrl ?? null,
      roles: user.roles.map((r) => r.role),
    };
  }

  private sign(user: { id: string; email: string; roles: { role: Role }[] }) {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.role),
    });
  }

  async register(dto: RegisterDto) {
    // Registro público siempre como CLIENTE; los demás roles se crean por invitación del admin.
    const email = this.normalizeEmail(dto.email);
    const telefono = normalizePhone(dto.telefono);
    await assertIdentityAvailable(this.prisma, { email, telefono });

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.usuario
      .create({
        data: {
          email,
          passwordHash,
          nombre: dto.nombre.trim(),
          apellido: dto.apellido?.trim() || null,
          telefono,
          roles: { create: [{ role: Role.CLIENTE }] },
        },
        include: { roles: true },
      })
      .catch((err) => rethrowUniqueViolation(err));

    return this.issueSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.usuario.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
      include: { roles: true },
    });
    if (!user || !user.activo) throw new UnauthorizedException('Credenciales inválidas');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');
    return this.issueSession(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.usuario.findUnique({ where: { email } });
    if (!user || !user.activo || user.eliminadoAt) {
      this.logger.warn(`Recuperación solicitada para un correo sin cuenta activa: ${email}`);
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const { token, tokenHash } = generateToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { usuarioId: user.id, used: false },
        data: { used: true },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          usuarioId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000),
        },
      }),
    ]);

    try {
      await this.mail.sendPasswordReset(user.email, user.nombre, token, RESET_TOKEN_MINUTES);
    } catch (err) {
      // La respuesta es idéntica exista o no la cuenta, para no revelar correos registrados.
      this.logger.error(`Falló el envío de recuperación para ${user.id}: ${(err as Error).message}`);
    }
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    });
    if (!record || record.used || record.expiresAt < new Date()) {
      throw new BadRequestException('El enlace es inválido o ya expiró. Solicita uno nuevo.');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: record.usuarioId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { usuarioId: record.usuarioId, used: false },
        data: { used: true },
      }),
    ]);
    return { message: 'Contraseña actualizada correctamente' };
  }
}
