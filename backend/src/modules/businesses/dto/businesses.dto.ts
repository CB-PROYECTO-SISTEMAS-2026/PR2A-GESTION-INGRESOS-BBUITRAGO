import { Transform } from 'class-transformer';
import { Producto_categoria } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
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
import {
  MAX_PRECIO,
  toStrictInt,
  toStrictMoney,
} from '../../../common/validation/validators';

/** Tope de unidades en stock por producto. */
export const MAX_STOCK = 100_000;

const STOCK_MESSAGE = `El stock debe ser un número entero entre 0 y ${MAX_STOCK.toLocaleString('es-BO')}.`;
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
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: PRECIO_MESSAGE },
  )
  @Min(0, { message: PRECIO_MESSAGE })
  @Max(MAX_PRECIO, { message: PRECIO_MESSAGE })
  precio: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  descripcion?: string;

  /** Unidades disponibles; null o vacío = el producto no controla stock. */
  @IsOptional()
  @Transform(toStrictInt)
  @IsInt({ message: STOCK_MESSAGE })
  @Min(0, { message: STOCK_MESSAGE })
  @Max(MAX_STOCK, { message: STOCK_MESSAGE })
  stock?: number | null;

  @IsOptional()
  @IsEnum(Producto_categoria, {
    message: 'La categoría del producto no es válida.',
  })
  categoria?: Producto_categoria;
}

export class UpdateProductoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(191)
  nombre?: string;

  @IsOptional()
  @Transform(toStrictMoney)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: PRECIO_MESSAGE },
  )
  @Min(0, { message: PRECIO_MESSAGE })
  @Max(MAX_PRECIO, { message: PRECIO_MESSAGE })
  precio?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  descripcion?: string;

  /** Unidades disponibles; null o vacío = el producto no controla stock. */
  @IsOptional()
  @Transform(toStrictInt)
  @IsInt({ message: STOCK_MESSAGE })
  @Min(0, { message: STOCK_MESSAGE })
  @Max(MAX_STOCK, { message: STOCK_MESSAGE })
  stock?: number | null;

  @IsOptional()
  @IsEnum(Producto_categoria, {
    message: 'La categoría del producto no es válida.',
  })
  categoria?: Producto_categoria;
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
