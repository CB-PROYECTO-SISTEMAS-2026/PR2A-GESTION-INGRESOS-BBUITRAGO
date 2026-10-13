import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const port = Number(app.get(ConfigService).get<string>('PORT') || 3000);
  await app.listen(port);
  console.log(`EvenTix API running on port ${port}`);
}
void bootstrap();
