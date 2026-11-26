import { Module } from '@nestjs/common';
import { IdentidadController } from './identidad.controller';
import { IdentidadService } from './identidad.service';

@Module({
  controllers: [IdentidadController],
  providers: [IdentidadService],
  exports: [IdentidadService],
})
export class IdentidadModule {}
