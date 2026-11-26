import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { BusinessesService } from './businesses.service';
import { SolicitudesNegocioService } from './solicitudes-negocio.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AsignarAyudanteDto,
  CreateAyudanteDto,
  CreateNegocioDto,
  CreateProductoDto,
  ListSolicitudesNegocioQuery,
  RevisarSolicitudNegocioDto,
  SolicitarParticipacionDto,
  UpdateAyudanteDto,
  UpdateNegocioDto,
  UpdateProductoDto,
} from './dto/businesses.dto';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessesController {
  constructor(
    private businessesService: BusinessesService,
    private solicitudesNegocio: SolicitudesNegocioService,
  ) {}

  @Get('negocios/eventos-disponibles')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  eventosDisponibles(@CurrentUser('id') userId: string) {
    return this.solicitudesNegocio.eventosDisponibles(userId);
  }

  @Get('negocios/solicitudes/mias')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  misSolicitudes(@CurrentUser('id') userId: string) {
    return this.solicitudesNegocio.misSolicitudes(userId);
  }

  @Post('negocios/solicitudes')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  solicitar(
    @CurrentUser('id') userId: string,
    @Body() dto: SolicitarParticipacionDto,
  ) {
    return this.solicitudesNegocio.solicitar(userId, dto);
  }

  @Patch('negocios/solicitudes/:id/cancelar')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  cancelar(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.solicitudesNegocio.cancelar(userId, id);
  }

  @Get('admin/negocios/solicitudes')
  @Roles(Role.ADMIN)
  adminSolicitudes(@Query() query: ListSolicitudesNegocioQuery) {
    return this.solicitudesNegocio.adminList(query.estado);
  }

  @Patch('admin/negocios/solicitudes/:id')
  @Roles(Role.ADMIN)
  revisar(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: RevisarSolicitudNegocioDto,
  ) {
    return this.solicitudesNegocio.revisar(userId, id, dto);
  }

  @Post('negocios')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  create(@CurrentUser('id') userId: string, @Body() dto: CreateNegocioDto) {
    return this.businessesService.createNegocio(userId, dto);
  }

  @Get('negocios/mios')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  mios(@CurrentUser('id') userId: string) {
    return this.businessesService.misNegocios(userId);
  }

  @Patch('negocios/:id')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNegocioDto,
  ) {
    return this.businessesService.updateNegocio(id, userId, dto);
  }

  @Post('negocios/:id/productos')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  createProducto(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProductoDto,
  ) {
    return this.businessesService.createProducto(id, userId, dto);
  }

  @Patch('productos/:id')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  updateProducto(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.businessesService.updateProducto(id, userId, dto);
  }

  @Delete('productos/:id')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  deleteProducto(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.businessesService.deleteProducto(id, userId);
  }

  @Post('negocios/:id/ayudantes')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  createAyudante(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAyudanteDto,
  ) {
    return this.businessesService.createAyudante(id, userId, dto);
  }

  @Patch('ayudantes/:id/asignar')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  asignar(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AsignarAyudanteDto,
  ) {
    return this.businessesService.asignarAyudante(id, userId, dto);
  }

  @Patch('ayudantes/:id')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  updateAyudante(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAyudanteDto,
  ) {
    return this.businessesService.updateAyudante(id, userId, dto);
  }

  @Delete('ayudantes/:id')
  @Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
  deleteAyudante(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.businessesService.deleteAyudante(id, userId);
  }
}
