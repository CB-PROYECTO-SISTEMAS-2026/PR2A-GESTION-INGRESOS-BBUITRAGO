import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/**
 * Chequeo simple para saber si la API y la base responden.
 * No reemplaza monitoreo completo; sirve para demos y para el futuro deploy.
 */
@Controller('api/health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      db: 'up',
      ms: Date.now() - started,
      at: new Date().toISOString(),
    };
  }
}
