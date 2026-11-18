import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { IncidenciasEventoService } from './incidencias.service';
import { ExportacionVentas } from './exportacion';
@Module({
  controllers: [ReportesController],
  providers: [ReportesService, IncidenciasEventoService, ExportacionVentas],
})
export class ReportesModule {}
