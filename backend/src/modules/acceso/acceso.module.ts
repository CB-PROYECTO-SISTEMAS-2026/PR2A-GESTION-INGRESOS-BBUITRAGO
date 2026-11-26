import { Module } from '@nestjs/common';
import { EntradasModule } from '../entradas/entradas.module';
import { IdentidadModule } from '../identidad/identidad.module';
import { AccesoService } from './acceso.service';
import { AccesoAdminController, AccesoController } from './acceso.controller';

/** Lo escaneado se identifica con EntradasService.resolverCodigoEscaneado (Módulo B, HU-015). */
@Module({
  imports: [EntradasModule, IdentidadModule],
  controllers: [AccesoController, AccesoAdminController],
  providers: [AccesoService],
})
export class AccesoModule {}
