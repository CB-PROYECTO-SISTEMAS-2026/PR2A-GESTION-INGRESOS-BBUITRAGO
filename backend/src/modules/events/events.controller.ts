import {
  Body,
  Controller,
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
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { memoryUpload } from '../../common/storage/upload.options';
import {
  CreateEventoDto,
  CreateSolicitudDto,
  ListSolicitudesQuery,
  RevisarSolicitudDto,
  UpdateEventoDto,
  UpdateMapaDto,
} from './dto/events.dto';

type AuthUser = { id: string; roles: Role[] };

@Controller('api')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Post('solicitudes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZADOR, Role.ADMIN)
  @UseInterceptors(FileInterceptor('mapa', memoryUpload))
  createSolicitud(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSolicitudDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.eventsService.createSolicitud(userId, dto, file);
  }

  @Get('solicitudes/mias')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZADOR, Role.ADMIN)
  misSolicitudes(@CurrentUser('id') userId: string) {
    return this.eventsService.misSolicitudes(userId);
  }

  @Get('solicitudes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  allSolicitudes(@Query() query: ListSolicitudesQuery) {
    return this.eventsService.allSolicitudes(query.estado);
  }

  @Get('solicitudes/:id')
  @UseGuards(JwtAuthGuard)
  getSolicitud(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.eventsService.getSolicitud(id, user);
  }

  @Patch('solicitudes/:id/revisar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  revisar(@Param('id') id: string, @Body() dto: RevisarSolicitudDto) {
    return this.eventsService.revisarSolicitud(id, dto);
  }

  @Post('solicitudes/:id/mapa')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZADOR, Role.ADMIN)
  @UseInterceptors(FileInterceptor('mapa', memoryUpload))
  updateMapaSolicitud(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMapaDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.eventsService.updateMapaSolicitud(id, user, file, dto);
  }

  @Post('eventos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createEvento(@Body() dto: CreateEventoDto) {
    return this.eventsService.createEvento(dto);
  }

  @Patch('eventos/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateEvento(@Param('id') id: string, @Body() dto: UpdateEventoDto) {
    return this.eventsService.updateEvento(id, dto);
  }

  @Post('eventos/:id/foto')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('foto', memoryUpload))
  updateFoto(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.eventsService.updateFoto(id, file);
  }

  @Get('eventos/admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminAll() {
    return this.eventsService.adminAll();
  }

  @Get('eventos/admin/organizadores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  organizadores() {
    return this.eventsService.listOrganizadores();
  }

  @Get('eventos/admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  adminDetail(@Param('id') id: string) {
    return this.eventsService.adminDetail(id);
  }

  @Get('eventos/public')
  publicList() {
    return this.eventsService.publicList();
  }

  @Get('eventos/public/:id')
  publicDetail(@Param('id') id: string) {
    return this.eventsService.publicDetail(id);
  }

  @Post('eventos/:id/mapa')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('mapa', memoryUpload))
  updateMapa(
    @Param('id') id: string,
    @Body() dto: UpdateMapaDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.eventsService.updateMapa(id, file, dto);
  }

  @Get('eventos/:id/mapa/historial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  mapaHistorial(@Param('id') id: string) {
    return this.eventsService.mapaHistorial(id);
  }
}
