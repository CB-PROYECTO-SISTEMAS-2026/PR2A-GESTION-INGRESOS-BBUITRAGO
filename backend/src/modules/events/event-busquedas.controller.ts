import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import {
  RegistrarBusquedaEventoDto,
  SugerenciasBusquedaEventoQuery,
} from './dto/event-busquedas.dto';
import { EventBusquedasService } from './event-busquedas.service';

@Controller('api/eventos/busquedas')
export class EventBusquedasController {
  constructor(private busquedas: EventBusquedasService) {}

  @Get('sugerencias')
  @UseGuards(OptionalJwtAuthGuard)
  sugerencias(
    @Query() query: SugerenciasBusquedaEventoQuery,
    @CurrentUser('id') usuarioId?: string,
  ) {
    return this.busquedas.sugerencias(query.visitorKey, usuarioId);
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  @UseGuards(OptionalJwtAuthGuard)
  registrar(
    @Body() dto: RegistrarBusquedaEventoDto,
    @CurrentUser('id') usuarioId?: string,
  ) {
    return this.busquedas.registrar(dto.termino, usuarioId, dto.visitorKey);
  }
}