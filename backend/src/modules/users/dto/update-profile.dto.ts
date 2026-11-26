import {
  IsOptional,
  IsString,
  IsNotEmpty,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido?: string;

  /** Marca pública del organizador. Vacío o null la quita. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @MaxLength(120)
  nombreProductora?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^[\d+\s()-]{7,20}$/, { message: 'Teléfono inválido' })
  telefono?: string;

  /** Día (AAAA-MM-DD); vacío o null quita la fecha. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Ingresa una fecha de nacimiento válida.',
  })
  fechaNac?: string | null;
}
