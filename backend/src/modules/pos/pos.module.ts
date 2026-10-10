import { Module } from '@nestjs/common';
import {
  NegocioPanelController,
  PosController,
  RetirosAdminController,
} from './pos.controller';
import { PosService } from './pos.service';
import { NegocioVentasService } from './negocio-ventas.service';
import { RetirosAdminService } from './retiros-admin.service';

@Module({
  controllers: [PosController, NegocioPanelController, RetirosAdminController],
  providers: [PosService, NegocioVentasService, RetirosAdminService],
})
export class PosModule {}
