import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { MovimientosService } from './movimientos.service';
import { MisMovimientosDto, MovimientosEventoDto } from './dto/movimientos.dto';

/** Saldo por evento y su historial de movimientos (HU-020). */
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MovimientosController {
  constructor(private movimientosService: MovimientosService) {}

  @Get('users/me/saldos')
  @Roles(Role.CLIENTE)
  misSaldos(@CurrentUser('id') userId: string) {
    return this.movimientosService.misSaldos(userId);
  }

  @Get('users/me/movimientos')
  @Roles(Role.CLIENTE)
  misMovimientos(
    @CurrentUser('id') userId: string,
    @Query() dto: MisMovimientosDto,
  ) {
    return this.movimientosService.misMovimientos(userId, dto);
  }

  @Get('eventos/:id/movimientos')
  @Roles(Role.ADMIN, Role.ORGANIZADOR)
  movimientosEvento(
    @CurrentUser() user: AuthUser,
    @Param('id') eventoId: string,
    @Query() dto: MovimientosEventoDto,
  ) {
    return this.movimientosService.movimientosEvento(user, eventoId, dto);
  }
}
