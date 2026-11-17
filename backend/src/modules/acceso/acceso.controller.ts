import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { AccesoService } from './acceso.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { memoryUpload } from '../../common/storage/upload.options';
import {
  AsignarEncargadoDto,
  CandidatosAccesoQuery,
  EscaneoDto,
  FechaAccesoQuery,
  RechazoAccesoDto,
  RegistroAccesoDto,
} from './dto/acceso.dto';

type AuthUser = { id: string; roles: Role[] };

/** HU-016, HU-017, HU-046: escaneo en puerta por el supervisor asignado al evento. */
@Controller('api/acceso')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ENCARGADO_ACCESO, Role.ADMIN)
export class AccesoController {
  constructor(private accesoService: AccesoService) {}

  @Get('mis-eventos')
  misEventos(@CurrentUser() user: AuthUser) {
    return this.accesoService.misEventos(user);
  }

  @Post('verificar')
  @HttpCode(200)
  verificar(@CurrentUser() user: AuthUser, @Body() dto: EscaneoDto) {
    return this.accesoService.verificar(user, dto);
  }

  @Post('registrar')
  @UseInterceptors(FileInterceptor('foto', memoryUpload))
  registrar(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegistroAccesoDto,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.accesoService.registrar(user, dto, foto);
  }

  @Post('rechazos')
  rechazar(@CurrentUser() user: AuthUser, @Body() dto: RechazoAccesoDto) {
    return this.accesoService.rechazar(user, dto);
  }

  @Get('eventos/:id/aforo')
  aforo(
    @CurrentUser() user: AuthUser,
    @Param('id') eventoId: string,
    @Query() query: FechaAccesoQuery,
  ) {
    return this.accesoService.aforoSupervisor(user, eventoId, query);
  }

  @Get('eventos/:id/registros')
  registros(
    @CurrentUser() user: AuthUser,
    @Param('id') eventoId: string,
    @Query() query: FechaAccesoQuery,
  ) {
    return this.accesoService.registrosSupervisor(user, eventoId, query);
  }
}

/** Administración del control de acceso: supervisores por evento, aforo y registros. */
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AccesoAdminController {
  constructor(private accesoService: AccesoService) {}

  @Get('admin/accesos/hoy')
  resumenHoy() {
    return this.accesoService.resumenHoy();
  }

  @Get('eventos/:id/acceso')
  panel(@Param('id') eventoId: string, @Query() query: FechaAccesoQuery) {
    return this.accesoService.panelEvento(eventoId, query);
  }

  @Get('eventos/:id/acceso/candidatos')
  candidatos(
    @Param('id') eventoId: string,
    @Query() query: CandidatosAccesoQuery,
  ) {
    return this.accesoService.candidatos(eventoId, query);
  }

  @Post('eventos/:id/acceso/supervisores')
  asignar(@Param('id') eventoId: string, @Body() dto: AsignarEncargadoDto) {
    return this.accesoService.asignarSupervisor(eventoId, dto);
  }

  @Delete('eventos/:id/acceso/supervisores/:usuarioId')
  quitar(@Param('id') eventoId: string, @Param('usuarioId') usuarioId: string) {
    return this.accesoService.quitarSupervisor(eventoId, usuarioId);
  }
}
