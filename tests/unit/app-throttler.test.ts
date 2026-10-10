/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  PRUEBA UNITARIA · Límite de peticiones por usuario (AppThrottlerGuard)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *  QUÉ VERIFICA
 *    A quién se le "cobra" cada petición para el límite de 120 peticiones por minuto:
 *      - Con un JWT válido → al usuario ("user:<id>"), aunque comparta IP con otros.
 *      - Con un JWT falso, vencido o firmado con otra clave → a la IP (no se puede usar un
 *        token inventado para esquivar el límite).
 *      - Sin sesión y con correo en el cuerpo (login, recuperar contraseña) → a la IP + correo,
 *        así un ataque a una cuenta no bloquea el login del resto del personal.
 *      - Detrás de un proxy (TRUST_PROXY=true) → a la IP real del cliente (X-Forwarded-For).
 *
 *  POR QUÉ IMPORTA
 *    En un evento, todos los celulares del personal (cajeros, recargadores, control de acceso)
 *    salen a internet por la misma IP del WiFi. Si el límite fuera por IP, unos pocos puntos de
 *    venta bloquearían a todos los demás en plena fila.
 *
 *  CÓDIGO PROBADO
 *    backend/src/common/guards/app-throttler.guard.ts
 *
 *  CÓMO EJECUTARLA
 *    cd tests
 *    npm install                             (solo la primera vez)
 *    npx jest unit/app-throttler.test.ts     (solo este archivo)
 *    npm run test:unit                       (todas las pruebas unitarias)
 *
 *  REQUISITOS
 *    Ninguno: no usa base de datos ni servidor. Los tokens se firman aquí con una clave de
 *    prueba; NO se usa el JWT_SECRET real del .env.
 *
 *  CÓMO LEER EL RESULTADO
 *    Cada caso compara la "clave de conteo" (tracker) que el guard calcula para una petición.
 *    Dos peticiones con el mismo tracker comparten el límite de 120 por minuto.
 *
 *  SI FALLA
 *    Si una petición con token inválido devuelve "user:...", hay un problema de seguridad:
 *    el guard estaría confiando en tokens sin verificar la firma.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import {
  AppThrottlerGuard,
  clientIp,
} from '../../backend/src/common/guards/app-throttler.guard';

const SECRETO = 'clave-solo-para-pruebas-unitarias-0123456789';

const guard = new AppThrottlerGuard(
  { throttlers: [] } as ThrottlerModuleOptions,
  {} as ThrottlerStorage,
  new Reflector(),
  { getOrThrow: () => SECRETO } as unknown as ConfigService,
);

/** getTracker es protegido en el guard; aquí se llama directamente para probarlo. */
const tracker = (req: Record<string, unknown>) =>
  (guard as unknown as { getTracker(r: unknown): Promise<string> }).getTracker(req);

const firmar = (payload: object, secreto = SECRETO) =>
  new JwtService({ secret: secreto }).sign(payload, { expiresIn: '60s' });

const conToken = (token: string) => ({
  ip: '10.0.0.5',
  headers: { authorization: `Bearer ${token}` },
});

describe('AppThrottlerGuard: a quién se cuenta cada petición', () => {
  it('con un JWT válido cuenta por usuario', async () => {
    expect(await tracker(conToken(firmar({ sub: 'usuario-1' })))).toBe('user:usuario-1');
  });

  it('dos usuarios desde la misma IP tienen límites separados', async () => {
    const a = await tracker(conToken(firmar({ sub: 'cajero-a' })));
    const b = await tracker(conToken(firmar({ sub: 'cajero-b' })));
    expect(a).not.toBe(b);
  });

  it('un token firmado con otra clave NO cuenta como usuario', async () => {
    const falso = firmar({ sub: 'admin' }, 'clave-de-un-atacante-9876543210');
    expect(await tracker(conToken(falso))).toBe('ip:10.0.0.5');
  });

  it('un token vencido NO cuenta como usuario', async () => {
    // Expiró hace un minuto (el campo exp va en el contenido, por eso no se usa firmar()).
    const vencido = new JwtService({ secret: SECRETO }).sign({
      sub: 'usuario-1',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    expect(await tracker(conToken(vencido))).toBe('ip:10.0.0.5');
  });

  it('un texto que no es un JWT NO cuenta como usuario', async () => {
    expect(await tracker(conToken('no-soy-un-token'))).toBe('ip:10.0.0.5');
  });

  it('sin sesión, el login cuenta por IP + correo (en minúsculas y sin espacios)', async () => {
    expect(await tracker({ ip: '10.0.0.5', body: { email: '  Cajero@Eventix.com ' } })).toBe(
      'ip:10.0.0.5|cajero@eventix.com',
    );
  });

  it('sin sesión y sin correo cuenta solo por IP', async () => {
    expect(await tracker({ ip: '10.0.0.5', body: {} })).toBe('ip:10.0.0.5');
  });
});

describe('clientIp(): IP del cliente', () => {
  it('detrás de un proxy usa la primera IP de X-Forwarded-For (req.ips)', () => {
    expect(clientIp({ ip: '172.16.0.1', ips: ['200.87.1.2', '172.16.0.1'] })).toBe('200.87.1.2');
  });

  it('sin proxy usa req.ip', () => {
    expect(clientIp({ ip: '10.0.0.5', ips: [] })).toBe('10.0.0.5');
  });

  it('si no hay IP devuelve "unknown" en lugar de fallar', () => {
    expect(clientIp({})).toBe('unknown');
  });
});
