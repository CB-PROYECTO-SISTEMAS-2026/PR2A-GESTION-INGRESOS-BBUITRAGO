import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DOCUMENT_TYPES } from '../../../common/security/identity-hmac';
import { trimString } from '../../../common/validation/validators';

export class RegistrarIdentidadDto {
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsIn([...DOCUMENT_TYPES], { message: 'Tipo de documento inválido.' })
  documentType: string;

  @IsString()
  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @Matches(/^[A-Z]{2}$/, { message: 'País emisor inválido (código ISO de 2 letras).' })
  documentCountry: string;

  /** Número completo; solo viaja por HTTPS y se descarta tras calcular HMAC. */
  @IsString()
  @Transform(trimString)
  @MinLength(4)
  @MaxLength(30)
  documentNumber: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(5)
  documentComplement?: string;

  @IsBoolean({ message: 'Debes aceptar el tratamiento de datos de identidad.' })
  consentimiento: boolean;
}

export class ActualizarIdentidadDto extends RegistrarIdentidadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}

export class VerificarSufijoDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona el evento.' })
  @MaxLength(191)
  eventoId: string;

  @IsString()
  @Transform(trimString)
  @MinLength(3)
  @MaxLength(191)
  codigo: string;

  /** Últimos 4 caracteres del documento; no se registran en logs. */
  @IsString()
  @Transform(trimString)
  @Matches(/^[A-Za-z0-9]{4}$/, {
    message: 'Ingresa exactamente los últimos 4 caracteres del documento.',
  })
  documentSuffix: string;
}
