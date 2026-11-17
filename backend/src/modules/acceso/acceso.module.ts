import { Module } from '@nestjs/common';
import { EntradasModule } from '../entradas/entradas.module';
import { AccesoService } from './acceso.service';
import { AccesoAdminController, AccesoController } from './acceso.controller';

/** Lo escaneado se identifica con EntradasService.resolverCodigoEscaneado (Módulo B, HU-015). */
@Module({
  imports: [EntradasModule],
  controllers: [AccesoController, AccesoAdminController],
  providers: [AccesoService],
})
export class AccesoModule {}
