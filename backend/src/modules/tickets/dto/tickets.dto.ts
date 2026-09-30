import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MAX_CAPACIDAD,
  MAX_PRECIO,
  toStrictInt,
  toStrictMoney,
  trimString,
} from '../../../common/validation/validators';

const PRECIO_MESSAGE = `El precio debe ser un monto entre 0 y ${MAX_PRECIO.toLocaleString('es-BO')} Bs, con hasta 2 decimales.`;
const CUPO_MESSAGE = `La cantidad de entradas debe ser un número entero entre 1 y ${MAX_CAPACIDAD.toLocaleString('es-BO')}.`;
export const MAX_BENEFICIOS = 20;
export const MAX_CODIGOS_POR_PAGINA = 48;

export class CreateCategoriaDto {
  @IsString()
  @Transform(trimString)
  @MinLength(2, { message: 'El nombre de la categoría debe tener al menos 2 caracteres.' })
  @MaxLength(100)
  nombre: string;

  @Transform(toStrictMoney)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }, { message: PRECIO_MESSAGE })
  @Min(0, { message: PRECIO_MESSAGE })
  @Max(MAX_PRECIO, { message: PRECIO_MESSAGE })
  precio: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BENEFICIOS, { message: `Puedes agregar hasta ${MAX_BENEFICIOS} beneficios.` })
  @IsString({ each: true })
  @MaxLength(120, { each: true, message: 'Cada beneficio puede tener hasta 120 caracteres.' })
  beneficios?: string[];

  @Transform(toStrictInt)
  @IsInt({ message: CUPO_MESSAGE })
  @Min(1, { message: CUPO_MESSAGE })
  @Max(MAX_CAPACIDAD, { message: CUPO_MESSAGE })
  cupo: number;

  /** Obligatorio solo en eventos de varios días; en eventos de un día se usa su única fecha. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fechaIds?: string[];
}

export class UpdateCategoriaDto {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MinLength(2, { message: 'El nombre de la categoría debe tener al menos 2 caracteres.' })
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @Transform(toStrictMoney)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }, { message: PRECIO_MESSAGE })
  @Min(0, { message: PRECIO_MESSAGE })
  @Max(MAX_PRECIO, { message: PRECIO_MESSAGE })
  precio?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BENEFICIOS, { message: `Puedes agregar hasta ${MAX_BENEFICIOS} beneficios.` })
  @IsString({ each: true })
  @MaxLength(120, { each: true, message: 'Cada beneficio puede tener hasta 120 caracteres.' })
  beneficios?: string[];

  @IsOptional()
  @Transform(toStrictInt)
  @IsInt({ message: CUPO_MESSAGE })
  @Min(1, { message: CUPO_MESSAGE })
  @Max(MAX_CAPACIDAD, { message: CUPO_MESSAGE })
  cupo?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fechaIds?: string[];
}

export class ListCodigosQuery {
  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  @Max(MAX_CODIGOS_POR_PAGINA)
  pageSize?: number;
}
