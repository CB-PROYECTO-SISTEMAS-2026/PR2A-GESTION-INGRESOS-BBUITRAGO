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
 * Roles de personal que se asignan por evento: el recargador (Módulo D del Sprint 2) y el
 * encargado de devoluciones (Módulo A del Sprint 3). El control de acceso se puede sumar aquí
 * cuando su módulo lo necesite.
 */
export const ROLES_PERSONAL = [Role.RECARGADOR, Role.DEVOLUCIONES] as const;

/**
 * Roles que se pueden asignar aunque el evento ya terminó o se canceló: las devoluciones de saldo
 * siguen hasta 30 días después del fin del evento.
 */
export const ROLES_POST_EVENTO: readonly RolPersonal[] = [Role.DEVOLUCIONES];
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
