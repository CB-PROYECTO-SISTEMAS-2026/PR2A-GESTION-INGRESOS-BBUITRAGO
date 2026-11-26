import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActualizarIdentidadDto,
  RegistrarIdentidadDto,
} from './dto/identidad.dto';
import {
  allIdentityHmacs,
  hashIdentity,
  hashSuffix,
  loadIdentitySecrets,
  normalizeIdentityDocument,
  safeEqualHex,
  verifySuffixHmac,
} from '../../common/security/identity-hmac';
import { DATA_IN_USE_MESSAGE, rethrowUniqueViolation } from '../../common/security/user-identity';

type Tx = Prisma.TransactionClient;

const IDENTITY_TAKEN =
  'Este documento ya está asociado a otra cuenta de Eventix.';
const IDENTITY_REQUIRED =
  'Registra tu identidad en el perfil antes de convertirte en titular de una entrada.';

@Injectable()
export class IdentidadService {
  private readonly secrets: ReturnType<typeof loadIdentitySecrets>;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.secrets = loadIdentitySecrets(config);
  }

  /** Vista pública segura: sin HMAC ni número completo. */
  async miIdentidad(usuarioId: string) {
    const row = await this.prisma.identidadUsuario.findUnique({
      where: { usuarioId },
      select: {
        documentType: true,
        documentCountry: true,
        documentMask: true,
        tieneComplemento: true,
        consentAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return {
      registrada: Boolean(row),
      identidad: row
        ? {
            ...row,
            estado: 'REGISTRADA' as const,
            etiqueta: `${row.documentType} ${row.documentCountry}: ${row.documentMask}`,
          }
        : null,
    };
  }

  async registrar(usuarioId: string, dto: RegistrarIdentidadDto) {
    if (!dto.consentimiento) {
      throw new BadRequestException(
        'Debes aceptar el tratamiento de tus datos de identidad para continuar.',
      );
    }
    const existing = await this.prisma.identidadUsuario.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Ya tienes una identidad registrada. Para cambiarla usa el procedimiento de actualización.',
      );
    }
    return this.guardarIdentidad(usuarioId, dto, 'REGISTRO');
  }

  /**
   * Cambio controlado: valida duplicados, audita y reemplaza huellas.
   * No permite “probar” documentos ajenos sin dejar rastro.
   */
  async actualizar(usuarioId: string, dto: ActualizarIdentidadDto) {
    if (!dto.consentimiento) {
      throw new BadRequestException(
        'Debes aceptar el tratamiento de tus datos de identidad para continuar.',
      );
    }
    if (!dto.motivo?.trim() || dto.motivo.trim().length < 10) {
      throw new BadRequestException(
        'Indica un motivo claro (mínimo 10 caracteres) para actualizar tu identidad.',
      );
    }
    const existing = await this.prisma.identidadUsuario.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(
        'No tienes una identidad registrada. Usa el registro inicial.',
      );
    }
    return this.guardarIdentidad(usuarioId, dto, 'ACTUALIZACION', dto.motivo.trim());
  }

  async requireIdentidad(usuarioId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    const id = await db.identidadUsuario.findUnique({
      where: { usuarioId },
      select: {
        id: true,
        documentMask: true,
        documentType: true,
        documentCountry: true,
        suffixHmac: true,
        suffixKeyVersion: true,
      },
    });
    if (!id) throw new BadRequestException(IDENTITY_REQUIRED);
    return id;
  }

  async tieneIdentidad(usuarioId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    const row = await db.identidadUsuario.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    return Boolean(row);
  }

  /**
   * Verifica los últimos 4 caracteres contra suffixHmac.
   * No registra ni registra el sufijo introducido.
   */
  verificarSufijoAlmacenado(
    suffixInput: string,
    suffixHmac: string,
    suffixKeyVersion: number,
  ) {
    return verifySuffixHmac(
      this.secrets,
      suffixInput,
      suffixHmac,
      suffixKeyVersion,
    );
  }

  private async guardarIdentidad(
    usuarioId: string,
    dto: RegistrarIdentidadDto,
    accion: 'REGISTRO' | 'ACTUALIZACION',
    motivo?: string,
  ) {
    let normalized;
    try {
      normalized = normalizeIdentityDocument({
        country: dto.documentCountry,
        type: dto.documentType as any,
        number: dto.documentNumber,
        complement: dto.documentComplement,
      });
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Documento inválido.',
      );
    }

    // Descartar el número del DTO lo antes posible en el flujo de negocio.
    (dto as { documentNumber?: string }).documentNumber = undefined;
    (dto as { documentComplement?: string }).documentComplement = undefined;

    const identity = hashIdentity(this.secrets, normalized.canonical);
    const suffix = hashSuffix(this.secrets, normalized.suffix);
    const candidates = allIdentityHmacs(this.secrets, normalized.canonical);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const taken = await tx.identidadUsuario.findFirst({
          where: {
            OR: candidates.map((c) => ({
              identityHmac: c.hmac,
              identityKeyVersion: c.version,
            })),
            NOT: { usuarioId },
          },
          select: { id: true },
        });
        if (taken) throw new ConflictException(IDENTITY_TAKEN);

        // Nombre en puerta sale del perfil; estas columnas solo cumplen NOT NULL.
        const usuario = await tx.usuario.findUniqueOrThrow({
          where: { id: usuarioId },
          select: { nombre: true, apellido: true },
        });

        const data = {
          nombresLegales: (usuario.nombre || '').trim() || 'Usuario',
          apellidosLegales: (usuario.apellido || '').trim() || '-',
          documentType: normalized.type,
          documentCountry: normalized.country,
          documentMask: normalized.mask,
          tieneComplemento: normalized.tieneComplemento,
          identityHmac: identity.hmac,
          identityKeyVersion: identity.version,
          suffixHmac: suffix.hmac,
          suffixKeyVersion: suffix.version,
          consentAt: new Date(),
        };

        const row =
          accion === 'REGISTRO'
            ? await tx.identidadUsuario.create({
                data: { usuarioId, ...data },
              })
            : await tx.identidadUsuario.update({
                where: { usuarioId },
                data,
              });

        // Mantener máscara en Usuario.documento para pantallas legacy; nunca el número completo.
        await tx.usuario.update({
          where: { id: usuarioId },
          data: { documento: normalized.mask },
        });

        await tx.auditoriaIdentidad.create({
          data: {
            usuarioId,
            actorId: usuarioId,
            accion,
            detalle:
              accion === 'ACTUALIZACION'
                ? `Motivo registrado (${motivo!.length} caracteres). Tipo ${normalized.type}/${normalized.country}.`
                : `Registro inicial. Tipo ${normalized.type}/${normalized.country}.`,
          },
        });

        return row;
      });

      return this.miIdentidad(usuarioId).then((r) => ({
        ...r,
        id: result.id,
      }));
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      rethrowUniqueViolation(err, IDENTITY_TAKEN);
    }
  }

  /** Comprueba si un HMAC recién calculado coincide con filas existentes (tests / admin). */
  async existeDocumento(parts: {
    country: string;
    type: string;
    number: string;
    complement?: string | null;
  }) {
    const normalized = normalizeIdentityDocument({
      country: parts.country,
      type: parts.type as any,
      number: parts.number,
      complement: parts.complement,
    });
    const candidates = allIdentityHmacs(this.secrets, normalized.canonical);
    const found = await this.prisma.identidadUsuario.findFirst({
      where: {
        OR: candidates.map((c) => ({
          identityHmac: c.hmac,
          identityKeyVersion: c.version,
        })),
      },
      select: { id: true },
    });
    return Boolean(found);
  }

  assertHmacOpaque(value: string) {
    if (!/^[a-f0-9]{64}$/i.test(value)) {
      throw new BadRequestException(DATA_IN_USE_MESSAGE);
    }
    return safeEqualHex(value, value);
  }
}

export { IDENTITY_REQUIRED };
