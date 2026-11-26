/** Cola de correos en la tabla Archivo (sin Redis ni tabla nueva). */
export const MAIL_OUTBOX_TIPO = 'MAIL_OUTBOX';
export const MAIL_URL_PENDING = 'mail://pending';
export const MAIL_URL_SENT = 'mail://sent';
export const MAIL_URL_FAILED = 'mail://failed';

export const MAIL_MAX_ATTEMPTS = 5;
/** Espera entre reintentos: 1 min, 2 min, 4 min, 8 min… */
export const MAIL_RETRY_BASE_MS = 60_000;

export type MailOutboxMeta = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
};

export function nextAttemptAt(attempts: number, from = new Date()): Date {
  const factor = Math.min(2 ** Math.max(0, attempts - 1), 16);
  return new Date(from.getTime() + MAIL_RETRY_BASE_MS * factor);
}
