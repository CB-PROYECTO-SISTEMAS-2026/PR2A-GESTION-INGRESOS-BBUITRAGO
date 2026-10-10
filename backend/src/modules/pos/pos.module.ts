import { Module } from '@nestjs/common';
import { NegocioPanelController, PosController } from './pos.controller';
import { PosService } from './pos.service';
import { NegocioVentasService } from './negocio-ventas.service';

@Module({
  controllers: [PosController, NegocioPanelController],
  providers: [PosService, NegocioVentasService],
})
export class PosModule {}
