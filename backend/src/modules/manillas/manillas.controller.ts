import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ManillasService } from './manillas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BuscarEntradaDto, ListEntregasQuery, VincularManillaDto } from './dto/manillas.dto';

type AuthUser = { id: string; roles: Role[] };

@Controller('api/manillas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ENCARGADO_ACCESO, Role.ADMIN)
export class ManillasController {
  constructor(private manillasService: ManillasService) {}

  @Get('mis-puntos')
  misPuntos(@CurrentUser() user: AuthUser) {
    return this.manillasService.misPuntos(user);
  }

  @Post('buscar')
  buscar(@CurrentUser() user: AuthUser, @Body() dto: BuscarEntradaDto) {
    return this.manillasService.buscar(user, dto);
  }

  @Post('vincular')
  vincular(@CurrentUser() user: AuthUser, @Body() dto: VincularManillaDto) {
    return this.manillasService.vincular(user, dto);
  }

  @Get('mis-entregas')
  misEntregas(@CurrentUser() user: AuthUser, @Query() query: ListEntregasQuery) {
    return this.manillasService.misEntregas(user, query);
  }
}
