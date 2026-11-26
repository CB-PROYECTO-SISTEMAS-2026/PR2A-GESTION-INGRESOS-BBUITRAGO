import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../../common/validation/validators';

export class RegistrarBusquedaEventoDto {
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'La búsqueda debe tener al menos 2 caracteres.' })
  @MaxLength(120)
  termino: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorKey?: string;
}

export class SugerenciasBusquedaEventoQuery {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorKey?: string;
}