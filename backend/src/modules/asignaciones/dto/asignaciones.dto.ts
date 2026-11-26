import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../../common/validation/validators';

export class AsignarAMiDto {
  // vacío a propósito: la entradaId va en la ruta
}

export class InvitarTitularDto {
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @MaxLength(191)
  email: string;
}

export class TransferirEntradaDto {
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @MaxLength(191)
  email: string;
}

export class AceptarAsignacionDto {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MinLength(20)
  @MaxLength(200)
  token?: string;
}

export class ConfigTransferenciaEventoDto {
  @IsOptional()
  permiteTransferencias?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  transferenciaHasta?: string | null;
}

export class TokenParamDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}
