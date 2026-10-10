import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  emptyToUndefined,
  toStrictInt,
  trimString,
} from '../../../common/validation/validators';

export const MAX_CANTIDAD_POR_PRODUCTO = 99;
export const MAX_ITEMS_POR_COBRO = 50;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'La fecha debe tener el formato AAAA-MM-DD.';

export class CobroItemDto {
  @IsString()
  @IsNotEmpty()
  productoId: string;

  @Transform(toStrictInt)
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad mínima es 1.' })
  @Max(MAX_CANTIDAD_POR_PRODUCTO, {
    message: `La cantidad máxima por producto es ${MAX_CANTIDAD_POR_PRODUCTO}.`,
  })
  cantidad: number;
}

export class CreateCobroDto {
  @IsString()
  @IsNotEmpty()
  eventoId: string;

  /** Contenido del QR escaneado (entrada digital) o código de la manilla. */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Escanea o ingresa el código del cliente.' })
  @MaxLength(191)
  codigo: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Selecciona al menos un producto.' })
  @ArrayMaxSize(MAX_ITEMS_POR_COBRO)
  @ValidateNested({ each: true })
  @Type(() => CobroItemDto)
  items: CobroItemDto[];
}

export class ConsultaClienteDto {
  @IsString()
  @IsNotEmpty()
  eventoId: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Escanea o ingresa el código del cliente.' })
  @MaxLength(191)
  codigo: string;
}

export class RangoFechasDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DAY_RE, { message: DAY_MESSAGE })
  desde?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DAY_RE, { message: DAY_MESSAGE })
  hasta?: string;
}

export class FiltroVentasNegocioDto extends RangoFechasDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  negocioId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  eventoId?: string;
}

export class ListadoVentasNegocioDto extends FiltroVentasNegocioDto {
  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  page?: number;
}

export class SolicitarRetiroDto {
  @IsString()
  @IsNotEmpty()
  negocioId: string;
}
