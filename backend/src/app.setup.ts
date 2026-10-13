import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { VALIDATION_PIPE_OPTIONS } from './common/validation/validation-pipe.options';

/**
 * Configuración de seguridad y de entrada de la API: cabeceras (helmet), CORS, proxy, tamaño
 * máximo del cuerpo y validación global. Está aparte de main.ts para que las pruebas
 * automatizadas (tests/integracion) levanten la aplicación exactamente igual que en producción.
 */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);

  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({ origin: origins, credentials: true });
  app.set(
    'trust proxy',
    config.get<string>('TRUST_PROXY') === 'true' ? 1 : false,
  );
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.enableShutdownHooks();
  return app;
}
