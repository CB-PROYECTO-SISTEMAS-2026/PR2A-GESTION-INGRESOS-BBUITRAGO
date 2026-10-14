import { Module } from '@nestjs/common';
import { EntradasModule } from '../entradas/entradas.module';
import { ComprasService } from './compras.service';
import {
  ComprasAdminController,
  ComprasController,
} from './compras.controller';

/** Al aprobar una compra se emiten sus entradas con EntradasService.emitirParaCompra (Módulo B). */
@Module({
  imports: [EntradasModule],
  controllers: [ComprasController, ComprasAdminController],
  providers: [ComprasService],
})
export class ComprasModule {}
