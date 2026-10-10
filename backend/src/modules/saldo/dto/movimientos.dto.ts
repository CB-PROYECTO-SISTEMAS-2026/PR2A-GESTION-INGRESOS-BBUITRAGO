import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EstadoTransaccion, TipoTransaccionSaldo } from '@prisma/client';
import {
  emptyToUndefined,
  toStrictInt,
} from '../../../common/validation/validators';
import { RangoFechasDto } from '../../pos/dto/pos.dto';

const TIPOS = Object.values(TipoTransaccionSaldo);
const ESTADOS = Object.values(EstadoTransaccion);

export class MisMovimientosDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecciona un evento.' })
  eventoId: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(TIPOS, { message: 'Tipo de movimiento no válido.' })
  tipo?: TipoTransaccionSaldo;
}

export class MovimientosEventoDto extends RangoFechasDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(TIPOS, { message: 'Tipo de movimiento no válido.' })
  tipo?: TipoTransaccionSaldo;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(ESTADOS, { message: 'Estado no válido.' })
  estado?: EstadoTransaccion;

  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  page?: number;
}
