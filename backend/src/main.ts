import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({ origin: origins, credentials: true });
  app.set('trust proxy', config.get<string>('TRUST_PROXY') === 'true' ? 1 : false);
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();

  const port = Number(config.get<string>('PORT') || 3000);
  await app.listen(port);
  console.log(`EvenTix API running on port ${port}`);
}
bootstrap();
