import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const PASSWORD_MESSAGE = 'La contraseña debe tener entre 8 y 72 caracteres, con al menos una letra y un número.';

export class RegisterDto {
  @IsEmail({}, { message: 'Correo inválido' })
  @MaxLength(191)
  email: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d+\s()-]{7,20}$/, { message: 'Teléfono inválido' })
  telefono?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Correo inválido' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Correo inválido' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
