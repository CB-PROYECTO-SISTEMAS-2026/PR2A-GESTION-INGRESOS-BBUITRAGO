import { Module } from '@nestjs/common';
import {
  NegocioPanelController,
  PosController,
  RetirosAdminController,
} from './pos.controller';
import { PosService } from './pos.service';
import { NegocioVentasService } from './negocio-ventas.service';
import { RetirosAdminService } from './retiros-admin.service';
import { SaldoModule } from '../saldo/saldo.module';

@Module({
  imports: [SaldoModule],
  controllers: [PosController, NegocioPanelController, RetirosAdminController],
  providers: [PosService, NegocioVentasService, RetirosAdminService],
})
export class PosModule {}
