import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../../common/validation/validators';

export class ContactoDto {
  @Transform(trimString)
  @IsEmail({}, { message: 'Correo inválido' })
  @MaxLength(191)
  email: string;

  @Transform(trimString)
  @IsString()
  @MinLength(10, { message: 'El mensaje debe tener al menos 10 caracteres.' })
  @MaxLength(2000, {
    message: 'El mensaje no puede superar los 2000 caracteres.',
  })
  mensaje: string;
}
