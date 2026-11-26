import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdentidadService } from './identidad.service';
import {
  ActualizarIdentidadDto,
  RegistrarIdentidadDto,
} from './dto/identidad.dto';

@Controller('api/users/me/identidad')
@UseGuards(JwtAuthGuard)
export class IdentidadController {
  constructor(private identidad: IdentidadService) {}

  @Get()
  miIdentidad(@CurrentUser('id') userId: string) {
    return this.identidad.miIdentidad(userId);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  registrar(
    @CurrentUser('id') userId: string,
    @Body() dto: RegistrarIdentidadDto,
  ) {
    return this.identidad.registrar(userId, dto);
  }

  @Patch()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  actualizar(
    @CurrentUser('id') userId: string,
    @Body() dto: ActualizarIdentidadDto,
  ) {
    return this.identidad.actualizar(userId, dto);
  }
}
