import { EstadoIncidencia, TipoIncidenciaRecarga } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  emptyToUndefined,
  toStrictInt,
  toStrictMoney,
  trimString,
} from '../../../common/validation/validators';
import { IDEMPOTENCY_KEY_RE, RangoFechasDto } from '../../pos/dto/pos.dto';
import {
  INCIDENCIA_TEXTO_MAX,
  METODOS_PAGO,
  MOTIVO_ANULACION_MAX,
  RECARGA_MAX,
  RECARGA_MIN,
  type MetodoPago,
} from '../recargas.constants';

export class ConsultaClienteRecargaDto {
  @IsString()
  @IsNotEmpty()
  eventoId: string;

  /** Contenido del QR escaneado (entrada digital) o código de la manilla. */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Escanea o ingresa el código del cliente.' })
  @MaxLength(191)
  codigo: string;
}

export class CreateRecargaDto extends ConsultaClienteRecargaDto {
  // class-validator evalúa de abajo hacia arriba y se detiene en el primer error: @IsNumber va
  // pegado a la propiedad para que "abc" diga "monto válido" y no "monto mínimo".
  @Transform(toStrictMoney)
  @Max(RECARGA_MAX, {
    message: `El monto máximo por recarga es Bs ${RECARGA_MAX}.`,
  })
  @Min(RECARGA_MIN, {
    message: `El monto mínimo por recarga es Bs ${RECARGA_MIN}.`,
  })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'Ingresa un monto válido (hasta 2 decimales).' },
  )
  monto: number;

  @IsOptional()
  @IsIn(METODOS_PAGO, {
    message: 'Por ahora solo se aceptan pagos en efectivo.',
  })
  metodoPago?: MetodoPago;

  /**
   * Clave que el terminal genera una vez por recarga y repite en los reintentos. Si la recarga
   * ya se registró con esta clave, se devuelve el mismo resultado en lugar de acreditar otra vez.
   */
  @IsOptional()
  @Matches(IDEMPOTENCY_KEY_RE, {
    message: 'La clave de la recarga no es válida.',
  })
  idempotencyKey?: string;
}

export class HistorialRecargasDto extends RangoFechasDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  eventoId?: string;
}

export const ESTADOS_RECARGA = ['COMPLETADA', 'ANULADA'] as const;

export class FiltroRecargasAdminDto extends HistorialRecargasDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(ESTADOS_RECARGA)
  estado?: (typeof ESTADOS_RECARGA)[number];

  /** Solo recargas con una incidencia en ese estado. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(EstadoIncidencia)
  incidencia?: EstadoIncidencia;

  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  page?: number;
}

export class AnularRecargaDto {
  @Transform(trimString)
  @IsString()
  @MinLength(5, {
    message: 'Escribe el motivo de la anulación (mínimo 5 caracteres).',
  })
  @MaxLength(MOTIVO_ANULACION_MAX, {
    message: `El motivo no puede superar ${MOTIVO_ANULACION_MAX} caracteres.`,
  })
  motivo: string;
}

export class ReportarIncidenciaDto {
  @IsEnum(TipoIncidenciaRecarga, {
    message: 'Elige qué tipo de problema tuvo la recarga.',
  })
  tipo: TipoIncidenciaRecarga;

  @Transform(trimString)
  @IsString()
  @MinLength(5, {
    message: 'Describe lo que pasó (mínimo 5 caracteres).',
  })
  @MaxLength(INCIDENCIA_TEXTO_MAX, {
    message: `La descripción no puede superar ${INCIDENCIA_TEXTO_MAX} caracteres.`,
  })
  descripcion: string;
}

export class ResolverIncidenciaDto {
  @Transform(trimString)
  @IsString()
  @MinLength(5, {
    message: 'Escribe cómo se resolvió (mínimo 5 caracteres).',
  })
  @MaxLength(INCIDENCIA_TEXTO_MAX, {
    message: `La resolución no puede superar ${INCIDENCIA_TEXTO_MAX} caracteres.`,
  })
  resolucion: string;
}
