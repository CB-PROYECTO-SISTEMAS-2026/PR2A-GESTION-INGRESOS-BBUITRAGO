import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  Matches,
  Max,
  Min,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { toStrictInt, trimString } from '../../../common/validation/validators';

/** Puerta en la que está el supervisor: cada escaneo se registra como ingreso o como salida (HU-017). */
export const SENTIDOS = ['ENTRADA', 'SALIDA'] as const;
export type Sentido = (typeof SENTIDOS)[number];

export class EscaneoDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona el evento.' })
  @MaxLength(191)
  eventoId: string;

  /** Contenido del QR de la manilla o del QR digital. */
  @IsString()
  @Transform(trimString)
  @MinLength(3, { message: 'Escanea el QR de la manilla o escribe su código.' })
  @MaxLength(191)
  codigo: string;

  @IsIn(SENTIDOS, { message: 'Indica si registras una entrada o una salida.' })
  sentido: Sentido;
}

export class RegistroAccesoDto extends EscaneoDto {
  /** El supervisor comparó la foto del primer ingreso con la persona y es la misma (HU-046). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  fotoVerificada?: boolean;

  /**
   * Últimos 4 caracteres del documento del titular (obligatorio en ingresos).
   * No se guarda en logs ni en base de datos.
   */
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @Matches(/^[A-Za-z0-9]{4}$/, {
    message: 'Ingresa exactamente los últimos 4 caracteres del documento.',
  })
  documentSuffix?: string;
}

export class VerificarDocumentoDto extends EscaneoDto {
  @IsString()
  @Transform(trimString)
  @Matches(/^[A-Za-z0-9]{4}$/, {
    message: 'Ingresa exactamente los últimos 4 caracteres del documento.',
  })
  documentSuffix: string;
}

export const MOTIVO_RECHAZO_MAX = 300;

export class RechazoAccesoDto extends EscaneoDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MOTIVO_RECHAZO_MAX)
  motivo?: string;
}

export class FechaAccesoQuery {
  /** Día del evento a consultar; por defecto, hoy. */
  @IsOptional()
  @IsString()
  @MaxLength(191)
  fechaId?: string;
}

export class HistorialAccesoQuery extends FechaAccesoQuery {
  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number;
}

export class CandidatosAccesoQuery {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(100)
  q?: string;
}

export class AsignarEncargadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona un supervisor.' })
  @MaxLength(191)
  usuarioId: string;
}
