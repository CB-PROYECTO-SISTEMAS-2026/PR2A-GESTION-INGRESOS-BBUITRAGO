import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
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
/** UUID u otro identificador aleatorio de 20 a 64 caracteres seguros. */
export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9-]{20,64}$/;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'La fecha debe tener el formato AAAA-MM-DD.';

export class CobroItemDto {
  @IsString()
  @IsNotEmpty()
  productoId: string;

  // Con stopAtFirstError se informa el primer validador que falla, y class-validator los evalúa
  // de abajo hacia arriba: @IsInt va pegado a la propiedad para que "1.5" diga "número entero"
  // y no "cantidad máxima".
  @Transform(toStrictInt)
  @Max(MAX_CANTIDAD_POR_PRODUCTO, {
    message: `La cantidad máxima por producto es ${MAX_CANTIDAD_POR_PRODUCTO}.`,
  })
  @Min(1, { message: 'La cantidad mínima es 1.' })
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
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

  /**
   * Clave que el terminal genera una vez por intento de cobro y repite en los reintentos.
   * Si el cobro ya se registró con esta clave, se devuelve el mismo resultado en lugar de cobrar
   * otra vez (evita cobros dobles cuando se pierde la respuesta por la red).
   */
  @IsOptional()
  @Matches(IDEMPOTENCY_KEY_RE, {
    message: 'La clave del cobro no es válida.',
  })
  idempotencyKey?: string;
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

export class FiltroRetirosDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(['SOLICITADO', 'APROBADO', 'PAGADO', 'RECHAZADO'])
  estado?: 'SOLICITADO' | 'APROBADO' | 'PAGADO' | 'RECHAZADO';
}

export class CambiarEstadoRetiroDto {
  @IsIn(['APROBADO', 'RECHAZADO'], {
    message: 'El estado debe ser APROBADO o RECHAZADO.',
  })
  estado: 'APROBADO' | 'RECHAZADO';
}
