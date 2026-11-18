import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DevolucionesService } from './devoluciones.service';
import {
  ConsultaClienteDevolucionDto,
  CreateDevolucionDto,
} from './dto/devoluciones.dto';

/** Terminal del encargado de devoluciones de saldo (HU-026, HU-027, HU-028). */
@Controller('api/devoluciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DEVOLUCIONES)
export class DevolucionesController {
  constructor(private devolucionesService: DevolucionesService) {}

  @Get('contexto')
  contexto(@CurrentUser('id') userId: string) {
    return this.devolucionesService.contexto(userId);
  }

  @Get('clientes')
  consultarCliente(
    @CurrentUser('id') userId: string,
    @Query() dto: ConsultaClienteDevolucionDto,
  ) {
    return this.devolucionesService.consultarCliente(userId, dto);
  }

  @Post()
  devolver(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDevolucionDto,
  ) {
    return this.devolucionesService.devolver(userId, dto);
  }
}
