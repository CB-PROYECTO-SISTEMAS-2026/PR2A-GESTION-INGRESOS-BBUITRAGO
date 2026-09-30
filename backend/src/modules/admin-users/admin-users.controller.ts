import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminUsersService } from './admin-users.service';
import {
  AceptarInvitacionDto,
  CreateInvitacionDto,
  ListInvitacionesQuery,
  ListUsuariosQuery,
  TokenDto,
} from './dto/admin-users.dto';

const MINUTE = 60_000;

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private service: AdminUsersService) {}

  @Get('usuarios')
  usuarios(@Query() query: ListUsuariosQuery) {
    return this.service.listUsuarios(query);
  }

  @Get('usuarios/:id')
  usuario(@Param('id') id: string) {
    return this.service.getUsuario(id);
  }

  @Delete('usuarios/:id')
  eliminarUsuario(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.service.eliminarUsuario(adminId, id);
  }

  @Get('invitaciones')
  invitaciones(@Query() query: ListInvitacionesQuery) {
    return this.service.listInvitaciones(query.estado);
  }

  @Post('invitaciones')
  @Throttle({ default: { limit: 20, ttl: 15 * MINUTE } })
  crear(@CurrentUser('id') adminId: string, @Body() dto: CreateInvitacionDto) {
    return this.service.createInvitacion(adminId, dto);
  }

  @Post('invitaciones/:id/reenviar')
  @Throttle({ default: { limit: 10, ttl: 15 * MINUTE } })
  reenviar(@Param('id') id: string) {
    return this.service.reenviar(id);
  }

  @Patch('invitaciones/:id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.service.cancelar(id);
  }
}

@Controller('api/invitaciones')
export class InvitacionesPublicController {
  constructor(private service: AdminUsersService) {}

  @Post('verificar')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * MINUTE } })
  verificar(@Body() dto: TokenDto) {
    return this.service.verificarToken(dto.token);
  }

  @Post('aceptar')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 15 * MINUTE } })
  aceptar(@Body() dto: AceptarInvitacionDto) {
    return this.service.aceptar(dto);
  }
}
