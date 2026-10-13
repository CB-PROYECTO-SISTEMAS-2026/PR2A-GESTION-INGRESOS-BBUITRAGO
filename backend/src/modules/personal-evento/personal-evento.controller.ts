import {
  Body,
  Controller,
  Delete,
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
import { PersonalEventoService } from './personal-evento.service';
import {
  AsignarPersonalDto,
  CandidatosPersonalDto,
} from './dto/personal-evento.dto';

/** Asignación de personal (recargadores) a cada evento por el administrador. */
@Controller('api/admin/eventos/:eventoId/personal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PersonalEventoController {
  constructor(private personalService: PersonalEventoService) {}

  @Get()
  listar(@Param('eventoId') eventoId: string) {
    return this.personalService.listar(eventoId);
  }

  @Get('candidatos')
  candidatos(
    @Param('eventoId') eventoId: string,
    @Query() dto: CandidatosPersonalDto,
  ) {
    return this.personalService.candidatos(eventoId, dto);
  }

  @Post()
  asignar(
    @Param('eventoId') eventoId: string,
    @Body() dto: AsignarPersonalDto,
  ) {
    return this.personalService.asignar(eventoId, dto);
  }

  @Delete(':asignacionId')
  quitar(
    @Param('eventoId') eventoId: string,
    @Param('asignacionId') asignacionId: string,
  ) {
    return this.personalService.quitar(eventoId, asignacionId);
  }
}
