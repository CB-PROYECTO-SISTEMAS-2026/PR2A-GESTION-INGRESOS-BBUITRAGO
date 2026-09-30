import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../../auth/dto/auth.dto';
import { MAX_PRECIO, toStrictMoney } from '../../../common/validation/validators';

const PRECIO_MESSAGE = `El precio debe ser un monto entre 0 y ${MAX_PRECIO.toLocaleString('es-BO')} Bs, con hasta 2 decimales.`;

export class CreateNegocioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  eventoId?: string;
}

export class UpdateNegocioDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  eventoId?: string;
}

export class CreateProductoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  nombre: string;

  @Transform(toStrictMoney)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }, { message: PRECIO_MESSAGE })
  @Min(0, { message: PRECIO_MESSAGE })
  @Max(MAX_PRECIO, { message: PRECIO_MESSAGE })
  precio: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  descripcion?: string;
}

export class UpdateProductoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  nombre?: string;

  @IsOptional()
  @Transform(toStrictMoney)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }, { message: PRECIO_MESSAGE })
  @Min(0, { message: PRECIO_MESSAGE })
  @Max(MAX_PRECIO, { message: PRECIO_MESSAGE })
  precio?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  descripcion?: string;
}

export class CreateAyudanteDto {
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
  @MaxLength(50)
  rolFuncion?: string;
}

export class AsignarAyudanteDto {
  @IsString()
  negocioId: string;
}
