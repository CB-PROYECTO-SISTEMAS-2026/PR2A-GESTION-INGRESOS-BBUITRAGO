import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { ComprasService } from './compras.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { memoryUpload } from '../../common/storage/upload.options';
import {
  CreateCompraDto,
  ListComprasQuery,
  RechazarCompraDto,
  UpdatePagoEventoDto,
} from './dto/compras.dto';

type AuthUser = { id: string; roles: Role[] };

/** HU-010, HU-011, HU-012: el usuario compra entradas y adjunta el comprobante del pago por QR. */
@Controller('api/compras')
@UseGuards(JwtAuthGuard)
export class ComprasController {
  constructor(private comprasService: ComprasService) {}

  @Get('eventos/:eventoId/checkout')
  checkout(@Param('eventoId') eventoId: string) {
    return this.comprasService.checkout(eventoId);
  }

  @Post('eventos/:eventoId')
  @UseGuards(RolesGuard)
  @Roles(Role.CLIENTE)
  @UseInterceptors(FileInterceptor('comprobante', memoryUpload))
  crear(
    @CurrentUser() user: AuthUser,
    @Param('eventoId') eventoId: string,
    @Body() dto: CreateCompraDto,
    @UploadedFile() comprobante?: Express.Multer.File,
  ) {
    return this.comprasService.crear(user, eventoId, dto, comprobante);
  }

  @Get('mias')
  @UseGuards(RolesGuard)
  @Roles(Role.CLIENTE)
  mias(@CurrentUser('id') userId: string) {
    return this.comprasService.misCompras(userId);
  }

  @Patch(':id/cancelar')
  @UseGuards(RolesGuard)
  @Roles(Role.CLIENTE)
  cancelar(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.comprasService.cancelar(userId, id);
  }
}

/** HU-013: el administrador verifica el comprobante y aprueba o rechaza cada compra. */
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ComprasAdminController {
  constructor(private comprasService: ComprasService) {}

  @Get('admin/compras')
  listar(@Query() query: ListComprasQuery) {
    return this.comprasService.listar(query);
  }

  @Get('admin/compras/:id')
  detalle(@Param('id') id: string) {
    return this.comprasService.detalle(id);
  }

  @Patch('admin/compras/:id/aprobar')
  aprobar(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.comprasService.aprobar(adminId, id);
  }

  @Patch('admin/compras/:id/rechazar')
  rechazar(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: RechazarCompraDto,
  ) {
    return this.comprasService.rechazar(adminId, id, dto);
  }

  @Get('eventos/:id/pago')
  pagoEvento(@Param('id') eventoId: string) {
    return this.comprasService.pagoEvento(eventoId);
  }

  @Post('eventos/:id/pago')
  @UseInterceptors(FileInterceptor('qr', memoryUpload))
  actualizarPagoEvento(
    @Param('id') eventoId: string,
    @Body() dto: UpdatePagoEventoDto,
    @UploadedFile() qr?: Express.Multer.File,
  ) {
    return this.comprasService.actualizarPagoEvento(eventoId, dto, qr);
  }

  @Delete('eventos/:id/pago/qr')
  quitarQrPago(@Param('id') eventoId: string) {
    return this.comprasService.quitarQrPago(eventoId);
  }
}
