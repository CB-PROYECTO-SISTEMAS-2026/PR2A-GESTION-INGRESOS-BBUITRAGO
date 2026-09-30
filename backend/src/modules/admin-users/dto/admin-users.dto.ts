import { InvitacionEstado, Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../../auth/dto/auth.dto';
import { toStrictInt } from '../../../common/validation/validators';

export const INVITABLE_ROLES = [Role.ADMIN, Role.ORGANIZADOR, Role.JEFE_NEGOCIO] as const;

export class CreateInvitacionDto {
  @IsEmail({}, { message: 'Correo inválido' })
  @MaxLength(191)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
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

  @IsIn(INVITABLE_ROLES, { message: 'Rol no permitido' })
  role: Role;
}

export class ListUsuariosQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(Role, { message: 'Rol no válido' })
  role?: Role;

  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  page?: number;
}

export class ListInvitacionesQuery {
  @IsOptional()
  @IsEnum(InvitacionEstado)
  estado?: InvitacionEstado;
}

export class TokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}

export class AceptarInvitacionDto extends TokenDto {
  @IsString()
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}
