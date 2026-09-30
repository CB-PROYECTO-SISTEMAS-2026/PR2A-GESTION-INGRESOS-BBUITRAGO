import { randomBytes } from 'crypto';

/** Sin 0/O, 1/I/L ni U para que el código se pueda leer y dictar sin confusiones. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export const TICKET_ESTADO_DISPONIBLE = 'GENERADO';

/** Código único de entrada, p. ej. "EVX-7K2M-Q9TD-4HXR" (~58 bits aleatorios). Es también el contenido del QR. */
export function newTicketCode() {
  const bytes = randomBytes(12);
  let chars = '';
  for (const b of bytes) chars += ALPHABET[b % ALPHABET.length];
  return `EVX-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function buildPoolRows(categoriaId: string, cantidad: number) {
  return Array.from({ length: cantidad }, () => {
    const codigo = newTicketCode();
    return { categoriaId, codigo, codigoQr: codigo, estado: TICKET_ESTADO_DISPONIBLE };
  });
}
