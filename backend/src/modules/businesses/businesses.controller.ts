import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BusinessesService } from './businesses.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  AsignarAyudanteDto,
  CreateAyudanteDto,
  CreateNegocioDto,
  CreateProductoDto,
  UpdateNegocioDto,
  UpdateProductoDto,
} from './dto/businesses.dto';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.JEFE_NEGOCIO, Role.ADMIN)
export class BusinessesController {
  constructor(private businessesService: BusinessesService) {}

  @Post('negocios')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateNegocioDto) {
    return this.businessesService.createNegocio(userId, dto);
  }

  @Get('negocios/mios')
  mios(@CurrentUser('id') userId: string) {
    return this.businessesService.misNegocios(userId);
  }

  @Patch('negocios/:id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNegocioDto,
  ) {
    return this.businessesService.updateNegocio(id, userId, dto);
  }

  @Post('negocios/:id/productos')
  createProducto(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProductoDto,
  ) {
    return this.businessesService.createProducto(id, userId, dto);
  }

  @Patch('productos/:id')
  updateProducto(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.businessesService.updateProducto(id, userId, dto);
  }

  @Delete('productos/:id')
  deleteProducto(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.businessesService.deleteProducto(id, userId);
  }

  @Post('negocios/:id/ayudantes')
  createAyudante(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAyudanteDto,
  ) {
    return this.businessesService.createAyudante(id, userId, dto);
  }

  @Patch('ayudantes/:id/asignar')
  asignar(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AsignarAyudanteDto,
  ) {
    return this.businessesService.asignarAyudante(id, userId, dto);
  }
}
