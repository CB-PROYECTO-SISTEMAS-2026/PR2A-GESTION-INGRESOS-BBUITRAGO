import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateCategoriaDto, ListCodigosQuery, UpdateCategoriaDto } from './dto/tickets.dto';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post('eventos/:id/categorias')
  create(@Param('id') eventoId: string, @Body() dto: CreateCategoriaDto) {
    return this.ticketsService.createCategoria(eventoId, dto);
  }

  @Get('eventos/:id/categorias')
  list(@Param('id') eventoId: string) {
    return this.ticketsService.listByEvento(eventoId);
  }

  @Patch('categorias/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoriaDto) {
    return this.ticketsService.updateCategoria(id, dto);
  }

  @Delete('categorias/:id')
  remove(@Param('id') id: string) {
    return this.ticketsService.deleteCategoria(id);
  }

  @Get('categorias/:id/codigos')
  codigos(@Param('id') id: string, @Query() query: ListCodigosQuery) {
    return this.ticketsService.listCodigos(id, query);
  }
}
