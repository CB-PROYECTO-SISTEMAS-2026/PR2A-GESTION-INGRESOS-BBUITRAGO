import { Module } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { SolicitudesNegocioService } from './solicitudes-negocio.service';

@Module({
  controllers: [BusinessesController],
  providers: [BusinessesService, SolicitudesNegocioService],
})
export class BusinessesModule {}
