import { Transform } from 'class-transformer';
import {
  AyudanteNegocio_estado,
  Producto_categoria,
  SolicitudNegocio_estado,
} from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
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
  trimString,
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
}

export class AsignarAyudanteDto {
  @IsString()
  negocioId: string;
}

export class UpdateAyudanteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido?: string;

  /** Solo ACTIVO puede cobrar en el POS de los eventos aceptados del negocio. */
  @IsOptional()
  @IsIn([AyudanteNegocio_estado.ACTIVO, AyudanteNegocio_estado.INACTIVO], {
    message: 'El estado debe ser ACTIVO o INACTIVO.',
  })
  estado?: 'ACTIVO' | 'INACTIVO';
}

export class SolicitarParticipacionDto {
  @IsString()
  @IsNotEmpty()
  eventoId: string;

  /** Opcional: el dueño solo tiene un negocio; se valida si llega. */
  @IsOptional()
  @IsString()
  negocioId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  mensaje?: string;
}

export class RevisarSolicitudNegocioDto {
  @IsIn([
    SolicitudNegocio_estado.ACEPTADA,
    SolicitudNegocio_estado.RECHAZADA,
  ])
  estado:
    | typeof SolicitudNegocio_estado.ACEPTADA
    | typeof SolicitudNegocio_estado.RECHAZADA;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  respuesta?: string;
}

export class ListSolicitudesNegocioQuery {
  @IsOptional()
  @IsEnum(SolicitudNegocio_estado)
  estado?: SolicitudNegocio_estado;
}
