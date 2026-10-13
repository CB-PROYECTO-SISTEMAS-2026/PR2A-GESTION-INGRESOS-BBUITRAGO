import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RecargasService } from './recargas.service';
import { RecargasAdminService } from './recargas-admin.service';
import {
  AnularRecargaDto,
  ConsultaClienteRecargaDto,
  CreateRecargaDto,
  FiltroRecargasAdminDto,
  HistorialRecargasDto,
} from './dto/recargas.dto';

/** Terminal del recargador de saldo (HU-019, HU-020, HU-047). */
@Controller('api/recargas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RECARGADOR)
export class RecargasController {
  constructor(private recargasService: RecargasService) {}

  @Get('contexto')
  contexto(@CurrentUser('id') userId: string) {
    return this.recargasService.contexto(userId);
  }

  @Get('clientes')
  consultarCliente(
    @CurrentUser('id') userId: string,
    @Query() dto: ConsultaClienteRecargaDto,
  ) {
    return this.recargasService.consultarCliente(userId, dto);
  }

  @Post()
  recargar(@CurrentUser('id') userId: string, @Body() dto: CreateRecargaDto) {
    return this.recargasService.recargar(userId, dto);
  }

  @Get('historial')
  historial(
    @CurrentUser('id') userId: string,
    @Query() dto: HistorialRecargasDto,
  ) {
    return this.recargasService.misRecargas(userId, dto);
  }
}

/** Revisión y anulación de recargas por el administrador general (HU-047). */
@Controller('api/admin/recargas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class RecargasAdminController {
  constructor(private recargasAdmin: RecargasAdminService) {}

  @Get()
  listar(@Query() dto: FiltroRecargasAdminDto) {
    return this.recargasAdmin.listar(dto);
  }

  @Post(':id/anular')
  anular(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: AnularRecargaDto,
  ) {
    return this.recargasAdmin.anular(adminId, id, dto.motivo);
  }
}
