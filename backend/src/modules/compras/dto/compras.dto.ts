import { BadRequestException } from '@nestjs/common';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CompraEstado } from '@prisma/client';
import {
  emptyToUndefined,
  toStrictInt,
  trimString,
} from '../../../common/validation/validators';

export const MAX_ENTRADAS_POR_COMPRA = 20;
const CANTIDAD_MESSAGE = `La cantidad debe ser un número entero entre 1 y ${MAX_ENTRADAS_POR_COMPRA}.`;
export const TELEFONO_RE = /^[\d+\s()-]{7,20}$/;

export class CompraItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona la categoría de cada entrada.' })
  @MaxLength(191)
  categoriaId: string;

  /** Obligatorio en eventos de varios días: el día al que vale la entrada. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(191)
  fechaId?: string;

  @Transform(toStrictInt)
  @IsInt({ message: CANTIDAD_MESSAGE })
  @Min(1, { message: CANTIDAD_MESSAGE })
  @Max(MAX_ENTRADAS_POR_COMPRA, { message: CANTIDAD_MESSAGE })
  cantidad: number;

  /** Entrada para otra persona (HU-011): nombre, correo y celular van juntos. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Transform(trimString)
  @MinLength(2, {
    message: 'El nombre de la persona debe tener al menos 2 caracteres.',
  })
  @MaxLength(100, {
    message: 'El nombre de la persona puede tener hasta 100 caracteres.',
  })
  paraNombre?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail({}, { message: 'El correo de la persona no es válido.' })
  @MaxLength(191)
  paraEmail?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(TELEFONO_RE, { message: 'El celular de la persona no es válido.' })
  paraTelefono?: string;
}

/** En multipart los ítems llegan como texto JSON junto al comprobante. */
const parseItems = ({ value }: { value: unknown }) => {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new BadRequestException('La lista de entradas no es válida.');
    }
  }
  return Array.isArray(raw)
    ? raw.map((item) => plainToInstance(CompraItemDto, item))
    : raw;
};

export class CreateCompraDto {
  @Transform(parseItems)
  @IsArray({ message: 'Agrega al menos una entrada.' })
  @ArrayMinSize(1, { message: 'Agrega al menos una entrada.' })
  @ArrayMaxSize(MAX_ENTRADAS_POR_COMPRA, {
    message: `Puedes comprar hasta ${MAX_ENTRADAS_POR_COMPRA} entradas por compra.`,
  })
  @ValidateNested({ each: true })
  @Type(() => CompraItemDto)
  items: CompraItemDto[];

  /** Número de operación o referencia de la transferencia (opcional). */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Transform(trimString)
  @MaxLength(100, {
    message: 'La referencia del pago puede tener hasta 100 caracteres.',
  })
  referencia?: string;
}

export class ListComprasQuery {
  @IsOptional()
  @IsIn(Object.values(CompraEstado), { message: 'Estado no válido.' })
  estado?: CompraEstado;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  eventoId?: string;

  /** Busca por correo o nombre del comprador. */
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(100)
  q?: string;
}

export class RechazarCompraDto {
  @IsString()
  @Transform(trimString)
  @MinLength(5, {
    message:
      'Explica al comprador el motivo del rechazo (al menos 5 caracteres).',
  })
  @MaxLength(500, { message: 'El motivo puede tener hasta 500 caracteres.' })
  motivo: string;
}

export class UpdatePagoEventoDto {
  /** Cadena vacía borra las instrucciones. */
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(1000, {
    message: 'Las instrucciones de pago pueden tener hasta 1000 caracteres.',
  })
  instruccionesPago?: string;
}
