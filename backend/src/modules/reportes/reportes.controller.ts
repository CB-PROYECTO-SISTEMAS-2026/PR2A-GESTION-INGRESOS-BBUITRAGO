import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { Response } from 'express';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { trimString, toStrictInt } from '../../common/validation/validators';
import { IDEMPOTENCY_KEY_RE } from '../pos/dto/pos.dto';
import { ReportesService } from './reportes.service';
import { ExportacionVentas } from './exportacion';
import { IncidenciasEventoService } from './incidencias.service';

class ExportarDto {
  @IsIn(['csv', 'xlsx']) formato: 'csv' | 'xlsx';
}
class IncidenciaDto {
  @Matches(IDEMPOTENCY_KEY_RE) idempotencyKey: string;
  @Transform(trimString) @IsString() @Length(1, 500) descripcion: string;
}
class ResolverDto {
  @Transform(trimString) @IsString() @Length(1, 500) resolucion: string;
}
class PaginaDto {
  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;
}

@Controller('api/reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesController {
  constructor(
    private reportes: ReportesService,
    private ventas: ExportacionVentas,
    private incidencias: IncidenciasEventoService,
  ) {}
  @Get('global')
  @Roles('ADMIN')
  global() {
    return this.reportes.resumen();
  }
  @Get('evento/:id')
  @Roles('ADMIN', 'ORGANIZADOR')
  async resumen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const evento = await this.reportes.evento(user, id);
    return { evento, ...(await this.reportes.resumen(id)) };
  }
  @Get('evento/:id/ventas')
  @Roles('ADMIN', 'ORGANIZADOR')
  async exportar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() dto: ExportarDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.reportes.evento(user, id);
    const bytes = await this.ventas.generar(id, dto.formato);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(bytes, {
      type:
        dto.formato === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="ventas.' + dto.formato + '"',
    });
  }
  @Post('evento/:id/incidencias')
  @Roles('ORGANIZADOR')
  async registrar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: IncidenciaDto,
  ) {
    await this.reportes.evento(user, id);
    return this.incidencias.registrar(
      id,
      user.id,
      dto.idempotencyKey,
      dto.descripcion,
    );
  }
  @Get('evento/:id/incidencias')
  @Roles('ADMIN', 'ORGANIZADOR')
  async listar(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() dto: PaginaDto,
  ) {
    await this.reportes.evento(user, id);
    return this.incidencias.listar(id, dto.page ?? 1);
  }
  @Patch('evento/:id/incidencias/:incidenciaId')
  @Roles('ADMIN')
  resolver(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('incidenciaId') incidenciaId: string,
    @Body() dto: ResolverDto,
  ) {
    return this.incidencias.resolver(id, incidenciaId, user.id, dto.resolucion);
  }
}
