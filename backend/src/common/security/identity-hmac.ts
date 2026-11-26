import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';

export const DOCUMENT_TYPES = ['CI', 'PASAPORTE', 'CE', 'OTRO'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface DocumentParts {
  country: string;
  type: DocumentType;
  number: string;
  complement?: string | null;
}

export interface NormalizedDocument {
  country: string;
  type: DocumentType;
  number: string;
  complement: string | null;
  /** Payload canónico para HMAC de identidad. */
  canonical: string;
  /** Últimos 4 dígitos/alfanuméricos del número (sin complemento). */
  suffix: string;
  /** Máscara para UI; nunca el número completo. */
  mask: string;
  tieneComplemento: boolean;
}

function requireSecret(config: ConfigService, key: string) {
  const value = config.get<string>(key)?.trim();
  if (!value || value.length < 32) {
    throw new Error(
      `${key} debe estar definido y tener al menos 32 caracteres.`,
    );
  }
  return value;
}

export function loadIdentitySecrets(config: ConfigService) {
  const identityCurrent = Number(
    config.get<string>('IDENTITY_HMAC_CURRENT_VERSION') || '1',
  );
  const suffixCurrent = Number(
    config.get<string>('SUFFIX_HMAC_CURRENT_VERSION') || '1',
  );
  const identitySecrets = new Map<number, string>();
  const suffixSecrets = new Map<number, string>();

  for (let v = 1; v <= Math.max(identityCurrent, 20); v++) {
    const idKey = config.get<string>(`IDENTITY_HMAC_SECRET_V${v}`)?.trim();
    if (idKey) identitySecrets.set(v, idKey);
    const sufKey = config.get<string>(`SUFFIX_HMAC_SECRET_V${v}`)?.trim();
    if (sufKey) suffixSecrets.set(v, sufKey);
  }

  if (!identitySecrets.has(identityCurrent)) {
    identitySecrets.set(
      identityCurrent,
      requireSecret(config, `IDENTITY_HMAC_SECRET_V${identityCurrent}`),
    );
  }
  if (!suffixSecrets.has(suffixCurrent)) {
    suffixSecrets.set(
      suffixCurrent,
      requireSecret(config, `SUFFIX_HMAC_SECRET_V${suffixCurrent}`),
    );
  }

  return { identityCurrent, suffixCurrent, identitySecrets, suffixSecrets };
}

/** Normaliza país ISO-2, tipo, número (preserva ceros) y complemento CI boliviano. */
export function normalizeIdentityDocument(input: DocumentParts): NormalizedDocument {
  const country = (input.country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error('País emisor inválido.');
  }
  const type = String(input.type || '').trim().toUpperCase() as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) {
    throw new Error('Tipo de documento inválido.');
  }

  // Conserva ceros iniciales; solo elimina separadores comunes.
  const number = (input.number || '')
    .trim()
    .toUpperCase()
    .replace(/[\s.\-_/]/g, '');
  if (!number || number.length < 4 || number.length > 30) {
    throw new Error('Número de documento inválido.');
  }
  if (!/^[A-Z0-9]+$/.test(number)) {
    throw new Error('El documento solo puede contener letras y números.');
  }

  let complement: string | null = null;
  const rawComp = input.complement?.trim().toUpperCase().replace(/[\s.\-]/g, '');
  if (rawComp) {
    if (country !== 'BO' || type !== 'CI') {
      throw new Error('El complemento solo aplica a CI boliviano.');
    }
    if (!/^[A-Z0-9]{1,5}$/.test(rawComp)) {
      throw new Error('Complemento de CI inválido.');
    }
    complement = rawComp;
  }

  const suffix = number.slice(-4);
  const mask = `${'*'.repeat(Math.max(number.length - 4, 2))}${suffix}`;
  const canonical = [country, type, number, complement ?? ''].join('|');

  return {
    country,
    type,
    number,
    complement,
    canonical,
    suffix,
    mask,
    tieneComplemento: Boolean(complement),
  };
}

export function hmacSha256Hex(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

export function safeEqualHex(a: string, b: string) {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function hashIdentity(
  secrets: ReturnType<typeof loadIdentitySecrets>,
  canonical: string,
  version = secrets.identityCurrent,
) {
  const secret = secrets.identitySecrets.get(version);
  if (!secret) throw new Error(`No hay secreto IDENTITY_HMAC_SECRET_V${version}.`);
  return { hmac: hmacSha256Hex(secret, canonical), version };
}

export function hashSuffix(
  secrets: ReturnType<typeof loadIdentitySecrets>,
  suffix: string,
  version = secrets.suffixCurrent,
) {
  const secret = secrets.suffixSecrets.get(version);
  if (!secret) throw new Error(`No hay secreto SUFFIX_HMAC_SECRET_V${version}.`);
  return { hmac: hmacSha256Hex(secret, suffix), version };
}

/** Genera huellas con todas las versiones conocidas (unicidad / migración de claves). */
export function allIdentityHmacs(
  secrets: ReturnType<typeof loadIdentitySecrets>,
  canonical: string,
) {
  return [...secrets.identitySecrets.entries()].map(([version, secret]) => ({
    version,
    hmac: hmacSha256Hex(secret, canonical),
  }));
}

export function verifySuffixHmac(
  secrets: ReturnType<typeof loadIdentitySecrets>,
  suffixDigits: string,
  storedHmac: string,
  storedVersion: number,
) {
  const cleaned = suffixDigits.replace(/\D/g, '');
  if (!/^\d{4}$/.test(cleaned) && !/^[A-Z0-9]{4}$/i.test(suffixDigits.trim())) {
    // Acepta 4 alfanuméricos del número normalizado o 4 dígitos.
  }
  const suffix = suffixDigits.trim().toUpperCase().replace(/[\s.\-]/g, '');
  if (suffix.length !== 4) return false;
  const { hmac } = hashSuffix(secrets, suffix, storedVersion);
  return safeEqualHex(hmac, storedHmac);
}
