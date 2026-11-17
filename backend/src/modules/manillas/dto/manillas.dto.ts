import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { emptyToUndefined, trimString } from '../../../common/validation/validators';

export const CODIGO_MANILLA_RE = /^[A-Z0-9-]{4,40}$/;
const CODIGO_MANILLA_MESSAGE = 'El código de la manilla debe tener de 4 a 40 letras, números o guiones.';

const toCodigoManilla = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreatePuntoRetiroDto {
  @IsString()
  @Transform(trimString)
  @MinLength(2, { message: 'El nombre del punto debe tener al menos 2 caracteres.' })
  @MaxLength(100, { message: 'El nombre del punto puede tener hasta 100 caracteres.' })
  nombre: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Transform(trimString)
  @MaxLength(191, { message: 'La ubicación puede tener hasta 191 caracteres.' })
  ubicacion?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Transform(trimString)
  @MaxLength(100, { message: 'El horario puede tener hasta 100 caracteres.' })
  horario?: string;
}

export class UpdatePuntoRetiroDto {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MinLength(2, { message: 'El nombre del punto debe tener al menos 2 caracteres.' })
  @MaxLength(100, { message: 'El nombre del punto puede tener hasta 100 caracteres.' })
  nombre?: string;

  /** Cadena vacía borra el dato. */
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(191, { message: 'La ubicación puede tener hasta 191 caracteres.' })
  ubicacion?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(100, { message: 'El horario puede tener hasta 100 caracteres.' })
  horario?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class AsignarSupervisorDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona un supervisor.' })
  @MaxLength(191)
  usuarioId: string;
}

export class CandidatosSupervisorQuery {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(100)
  q?: string;
}

export class BuscarEntradaDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona el punto de entrega.' })
  @MaxLength(191)
  puntoId: string;

  /** Código de la entrada (QR que muestra el cliente), correo, documento o código de una manilla. */
  @IsString()
  @Transform(trimString)
  @MinLength(3, { message: 'Escanea el QR de la entrada o escribe el código, correo o documento del cliente.' })
  @MaxLength(191)
  busqueda: string;
}

export class VincularManillaDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona el punto de entrega.' })
  @MaxLength(191)
  puntoId: string;

  @IsString()
  @IsNotEmpty({ message: 'Selecciona la entrada del cliente.' })
  @MaxLength(191)
  entradaId: string;

  @IsString()
  @Transform(toCodigoManilla)
  @Matches(CODIGO_MANILLA_RE, { message: CODIGO_MANILLA_MESSAGE })
  codigoManilla: string;
}

export class ListEntregasQuery {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  puntoId?: string;
}
