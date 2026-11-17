import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PuntosRetiroService } from './puntos-retiro.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AsignarSupervisorDto,
  CandidatosSupervisorQuery,
  CreatePuntoRetiroDto,
  UpdatePuntoRetiroDto,
} from './dto/manillas.dto';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PuntosRetiroController {
  constructor(private puntosRetiroService: PuntosRetiroService) {}

  @Get('eventos/:id/puntos-retiro')
  listar(@Param('id') eventoId: string) {
    return this.puntosRetiroService.listar(eventoId);
  }

  @Post('eventos/:id/puntos-retiro')
  crear(@Param('id') eventoId: string, @Body() dto: CreatePuntoRetiroDto) {
    return this.puntosRetiroService.crear(eventoId, dto);
  }

  @Get('eventos/:id/manillas')
  entregas(@Param('id') eventoId: string) {
    return this.puntosRetiroService.entregas(eventoId);
  }

  @Patch('puntos-retiro/:id')
  actualizar(@Param('id') id: string, @Body() dto: UpdatePuntoRetiroDto) {
    return this.puntosRetiroService.actualizar(id, dto);
  }

  @Delete('puntos-retiro/:id')
  eliminar(@Param('id') id: string) {
    return this.puntosRetiroService.eliminar(id);
  }

  @Get('puntos-retiro/:id/candidatos')
  candidatos(@Param('id') id: string, @Query() query: CandidatosSupervisorQuery) {
    return this.puntosRetiroService.candidatos(id, query);
  }

  @Post('puntos-retiro/:id/supervisores')
  asignarSupervisor(@Param('id') id: string, @Body() dto: AsignarSupervisorDto) {
    return this.puntosRetiroService.asignarSupervisor(id, dto);
  }

  @Delete('puntos-retiro/:id/supervisores/:usuarioId')
  quitarSupervisor(@Param('id') id: string, @Param('usuarioId') usuarioId: string) {
    return this.puntosRetiroService.quitarSupervisor(id, usuarioId);
  }
}
