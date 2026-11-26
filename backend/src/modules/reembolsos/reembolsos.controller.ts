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
import { Throttle } from '@nestjs/throttler';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { memoryUpload } from '../../common/storage/upload.options';
import { trimString, toStrictInt } from '../../common/validation/validators';
import { IdentidadService } from './identidad.service';
import { ReembolsoEntradasService } from './entradas.service';

class SolicitudDto {
  @Transform(trimString) @IsString() @Length(1, 500) motivo: string;
}
class DecisionDto {
  @IsIn(['APROBADO', 'RECHAZADO', 'PAGADO']) estado:
    | 'APROBADO'
    | 'RECHAZADO'
    | 'PAGADO';
}
class PaginaDto {
  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;
}

const MINUTE = 60_000;

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReembolsosController {
  constructor(
    private entradas: ReembolsoEntradasService,
    private identidad: IdentidadService,
  ) {}

  @Post('devoluciones/:id/comprobante')
  @Roles('DEVOLUCIONES')
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @UseInterceptors(FileInterceptor('foto', memoryUpload))
  comprobante(
    @CurrentUser('id') operador: string,
    @Param('id') id: string,
    @UploadedFile() foto?: Express.Multer.File,
  ) {
    return this.identidad.comprobante(operador, id, foto);
  }

  @Post('entradas/:id/reembolso')
  @Roles('CLIENTE')
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  solicitar(
    @CurrentUser('id') usuario: string,
    @Param('id') id: string,
    @Body() dto: SolicitudDto,
  ) {
    return this.entradas.solicitar(usuario, id, dto.motivo);
  }

  @Get('users/me/reembolsos')
  @Roles('CLIENTE')
  propios(@CurrentUser('id') usuario: string, @Query() dto: PaginaDto) {
    return this.entradas.listar(usuario, dto.page ?? 1);
  }

  @Get('admin/reembolsos')
  @Roles('ADMIN')
  listar(@Query() dto: PaginaDto) {
    return this.entradas.listar(undefined, dto.page ?? 1);
  }

  @Patch('admin/reembolsos/:id')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 40, ttl: MINUTE } })
  @UseInterceptors(FileInterceptor('evidencia', memoryUpload))
  resolver(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
    @UploadedFile() evidencia?: Express.Multer.File,
  ) {
    return this.entradas.resolver(id, dto.estado, adminId, evidencia);
  }
}
