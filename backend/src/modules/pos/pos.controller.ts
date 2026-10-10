import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PosService } from './pos.service';
import { NegocioVentasService } from './negocio-ventas.service';
import { RetirosAdminService } from './retiros-admin.service';
import { memoryUpload } from '../../common/storage/upload.options';
import {
  CambiarEstadoRetiroDto,
  ConsultaClienteDto,
  CreateCobroDto,
  FiltroRetirosDto,
  FiltroVentasNegocioDto,
  ListadoVentasNegocioDto,
  RangoFechasDto,
  SolicitarRetiroDto,
} from './dto/pos.dto';

/** Terminal de punto de venta del ayudante (HU-022, HU-023, HU-024). */
@Controller('api/pos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.AYUDANTE)
export class PosController {
  constructor(private posService: PosService) {}

  @Get('contexto')
  contexto(@CurrentUser('id') userId: string) {
    return this.posService.contexto(userId);
  }

  @Get('clientes')
  consultarCliente(
    @CurrentUser('id') userId: string,
    @Query() dto: ConsultaClienteDto,
  ) {
    return this.posService.consultarCliente(userId, dto);
  }

  @Post('cobros')
  cobrar(@CurrentUser('id') userId: string, @Body() dto: CreateCobroDto) {
    return this.posService.cobrar(userId, dto);
  }

  @Get('ventas')
  misVentas(@CurrentUser('id') userId: string, @Query() dto: RangoFechasDto) {
    return this.posService.misVentas(userId, dto);
  }
}

/** Ventas consolidadas y liquidación para el dueño del negocio (HU-025). */
@Controller('api/negocio-panel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
export class NegocioPanelController {
  constructor(private ventasService: NegocioVentasService) {}

  @Get('resumen')
  resumen(
    @CurrentUser('id') userId: string,
    @Query() dto: FiltroVentasNegocioDto,
  ) {
    return this.ventasService.resumen(userId, dto);
  }

  @Get('ventas')
  ventas(
    @CurrentUser('id') userId: string,
    @Query() dto: ListadoVentasNegocioDto,
  ) {
    return this.ventasService.ventas(userId, dto);
  }

  @Get('ventas/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportar(
    @CurrentUser('id') userId: string,
    @Query() dto: FiltroVentasNegocioDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, content } = await this.ventasService.exportarCsv(
      userId,
      dto,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return content;
  }

  @Get('liquidacion')
  liquidacion(
    @CurrentUser('id') userId: string,
    @Query('negocioId') negocioId?: string,
  ) {
    return this.ventasService.liquidacion(userId, negocioId || undefined);
  }

  @Post('retiros')
  solicitarRetiro(
    @CurrentUser('id') userId: string,
    @Body() dto: SolicitarRetiroDto,
  ) {
    return this.ventasService.solicitarRetiro(userId, dto.negocioId);
  }
}

/** Gestión de retiros de los dueños de negocio por parte del administrador (HU-025). */
@Controller('api/admin/retiros')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class RetirosAdminController {
  constructor(private retirosService: RetirosAdminService) {}

  @Get()
  listar(@Query() dto: FiltroRetirosDto) {
    return this.retirosService.listar(dto.estado);
  }

  @Patch(':id/estado')
  cambiarEstado(@Param('id') id: string, @Body() dto: CambiarEstadoRetiroDto) {
    return this.retirosService.cambiarEstado(id, dto.estado);
  }

  @Post(':id/pagar')
  @UseInterceptors(FileInterceptor('evidencia', memoryUpload))
  pagar(
    @Param('id') id: string,
    @UploadedFile() evidencia?: Express.Multer.File,
  ) {
    return this.retirosService.pagar(id, evidencia);
  }
}
