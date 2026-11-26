import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AsignacionesService } from './asignaciones.service';
import {
  AceptarAsignacionDto,
  InvitarTitularDto,
  TransferirEntradaDto,
} from './dto/asignaciones.dto';

type AuthUser = { id: string; roles: Role[]; email?: string };

@Controller('api/asignaciones')
export class AsignacionesController {
  constructor(private asignaciones: AsignacionesService) {}

  /** Vista previa pública del enlace (sin revelar si el correo tiene cuenta). */
  @Get('preview')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  preview(@Query('token') token: string) {
    return this.asignaciones.previewPorToken(token);
  }

  @Get('mias')
  @UseGuards(JwtAuthGuard)
  misInvitaciones(@CurrentUser('id') userId: string) {
    return this.asignaciones.misInvitaciones(userId);
  }

  @Get('compradas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENTE, Role.ADMIN)
  compradas(@CurrentUser('id') userId: string) {
    return this.asignaciones.misComprasEntradas(userId);
  }

  @Post('entradas/:id/asignarme')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  asignarme(@CurrentUser() user: AuthUser, @Param('id') entradaId: string) {
    return this.asignaciones.asignarme(user, entradaId);
  }

  @Post('entradas/:id/invitar')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  invitar(
    @CurrentUser() user: AuthUser,
    @Param('id') entradaId: string,
    @Body() dto: InvitarTitularDto,
  ) {
    return this.asignaciones.invitar(user, entradaId, dto);
  }

  @Post('entradas/:id/transferir')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  transferir(
    @CurrentUser() user: AuthUser,
    @Param('id') entradaId: string,
    @Body() dto: TransferirEntradaDto,
  ) {
    return this.asignaciones.transferir(user, entradaId, dto);
  }

  @Post(':id/cancelar')
  @UseGuards(JwtAuthGuard)
  cancelar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.asignaciones.cancelarInvitacion(user, id);
  }

  @Post(':id/reenviar')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reenviar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.asignaciones.reenviarInvitacion(user, id);
  }

  @Post(':id/aceptar')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  aceptar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AceptarAsignacionDto,
  ) {
    return this.asignaciones.aceptar(user, id, dto.token);
  }

  @Post(':id/rechazar')
  @UseGuards(JwtAuthGuard)
  rechazar(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.asignaciones.rechazar(user, id);
  }
}
