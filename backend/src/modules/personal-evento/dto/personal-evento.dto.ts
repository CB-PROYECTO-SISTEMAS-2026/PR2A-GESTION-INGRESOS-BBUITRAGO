import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import {
  emptyToUndefined,
  trimString,
} from '../../../common/validation/validators';

/**
 * Roles de personal que se asignan por evento. Por ahora solo el recargador (Módulo D); el
 * control de acceso y las devoluciones se pueden sumar aquí cuando sus módulos lo necesiten.
 */
export const ROLES_PERSONAL = [Role.RECARGADOR] as const;
export type RolPersonal = (typeof ROLES_PERSONAL)[number];

const ROL_MESSAGE = 'Rol de personal no válido.';

export class AsignarPersonalDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona un usuario.' })
  usuarioId: string;

  @IsIn(ROLES_PERSONAL, { message: ROL_MESSAGE })
  role: RolPersonal;
}

export class CandidatosPersonalDto {
  @IsIn(ROLES_PERSONAL, { message: ROL_MESSAGE })
  role: RolPersonal;

  @IsOptional()
  @Transform(trimString)
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  q?: string;
}
