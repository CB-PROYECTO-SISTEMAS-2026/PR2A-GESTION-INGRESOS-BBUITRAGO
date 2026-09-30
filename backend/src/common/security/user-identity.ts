import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** No revela qué dato coincide para no exponer qué correos/teléfonos/documentos están registrados. */
export const USER_EXISTS_MESSAGE = 'El usuario ya existe. Inicia sesión con tu cuenta.';
export const USER_EXISTS_FOR_OTHER_MESSAGE =
  'El usuario ya existe. Debe iniciar sesión con su cuenta existente.';
export const DATA_IN_USE_MESSAGE = 'Los datos ingresados ya pertenecen a otra cuenta.';

const DEFAULT_COUNTRY_CODE = '591';
const LOCAL_PHONE_DIGITS = 8;

export interface UserIdentity {
  email?: string | null;
  telefono?: string | null;
  documento?: string | null;
}

type UsuarioReader = Pick<Prisma.TransactionClient, 'usuario'>;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Forma canónica para que "70012345", "700 12345" y "+591 70012345" cuenten como el mismo número.
 * Un número local de 8 dígitos se asume boliviano.
 */
export function normalizePhone(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === LOCAL_PHONE_DIGITS) return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  if (digits.length === DEFAULT_COUNTRY_CODE.length + LOCAL_PHONE_DIGITS && digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    return `+${digits}`;
  }
  return digits;
}

/** "1234567 lp", "1234567-LP" y "1.234.567 LP" cuentan como el mismo documento. */
export function normalizeDocument(value?: string | null) {
  const normalized = value?.trim().toUpperCase().replace(/[\s.-]/g, '');
  return normalized || null;
}

export async function isIdentityTaken(db: UsuarioReader, identity: UserIdentity, excludeUserId?: string) {
  const or: Prisma.UsuarioWhereInput[] = [];
  if (identity.email) or.push({ email: identity.email });
  if (identity.telefono) or.push({ telefono: identity.telefono });
  if (identity.documento) or.push({ documento: identity.documento });
  if (!or.length) return false;

  const found = await db.usuario.findFirst({
    where: { OR: or, ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}) },
    select: { id: true },
  });
  return Boolean(found);
}

export async function assertIdentityAvailable(
  db: UsuarioReader,
  identity: UserIdentity,
  message = USER_EXISTS_MESSAGE,
  excludeUserId?: string,
) {
  if (await isIdentityTaken(db, identity, excludeUserId)) throw new ConflictException(message);
}

/** Cubre la carrera entre la verificación previa y el insert (índices únicos de Usuario). */
export function rethrowUniqueViolation(err: unknown, message = USER_EXISTS_MESSAGE): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new ConflictException(message);
  }
  throw err;
}
