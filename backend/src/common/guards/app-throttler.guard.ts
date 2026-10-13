import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';

type ThrottledRequest = {
  ip?: string;
  ips?: string[];
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

/** IP del cliente (la primera de X-Forwarded-For cuando TRUST_PROXY está activo). */
export function clientIp(req: ThrottledRequest): string {
  return req.ips?.length ? req.ips[0] : (req.ip ?? 'unknown');
}

/**
 * Cuenta las peticiones por usuario en lugar de por IP.
 *
 * En un evento, los celulares del personal (cajeros, recargadores, control de acceso) salen a
 * internet por la misma IP del WiFi; contando por IP, unos pocos puntos de venta agotarían el
 * límite de todos. Con sesión válida el límite es por usuario (el JWT se verifica, así que no
 * se puede falsificar otro `sub`); sin sesión es por IP + correo, para que el login de un
 * miembro del personal no bloquee el de los demás. El throttler "ip" de AppModule sigue
 * poniendo un tope por IP como respaldo.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly jwt: JwtService;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.jwt = new JwtService({
      secret: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  protected async getTracker(req: ThrottledRequest): Promise<string> {
    const header = req.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub?: string }>(
          header.slice(7),
        );
        if (payload.sub) return `user:${payload.sub}`;
      } catch {
        // Token inválido o vencido: se cuenta como petición anónima.
      }
    }
    const body = req.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    return email ? `ip:${clientIp(req)}|${email}` : `ip:${clientIp(req)}`;
  }
}
