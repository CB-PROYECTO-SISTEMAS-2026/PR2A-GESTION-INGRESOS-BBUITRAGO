import { Transform, type TransformFnParams } from 'class-transformer';
import {
  Equals,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  toStrictMoney,
  trimString,
} from '../../../common/validation/validators';
import { IDEMPOTENCY_KEY_RE } from '../../pos/dto/pos.dto';

/** HU-026 / HU-027: identificar al cliente por su manilla o QR en el evento asignado. */
export class ConsultaClienteDevolucionDto {
  @IsString()
  @IsNotEmpty()
  eventoId: string;

  /** Contenido del QR escaneado (entrada digital) o código de la manilla. */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Escanea o ingresa el código del cliente.' })
  @MaxLength(191)
  codigo: string;
}

/** HU-028: devolución en efectivo de todo el saldo del cliente en el evento. */
export class CreateDevolucionDto extends ConsultaClienteDevolucionDto {
  /**
   * Monto que el encargado vio en pantalla. Si el saldo cambió desde la consulta, la devolución
   * se rechaza para que nunca se entregue un monto distinto al que se descuenta.
   */
  @Transform(toStrictMoney)
  @Min(0.01, { message: 'El cliente no tiene saldo para devolver.' })
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'Ingresa un monto válido (hasta 2 decimales).' },
  )
  montoEsperado: number;

  /**
   * El encargado confirma que la persona coincide con la foto del primer ingreso o, si no hay
   * foto, que verificó su documento de identidad.
   *
   * Se valida el valor original del cuerpo: la conversión implícita global convertiría el texto
   * "false" en `true`. Solo vale el booleano `true`.
   */
  @Transform(({ obj, key }: TransformFnParams) =>
    obj && key in obj ? (obj as Record<string, unknown>)[key] : undefined,
  )
  @Equals(true, {
    message:
      'Confirma que verificaste la identidad de la persona antes de devolver el saldo.',
  })
  identidadVerificada: boolean;

  /**
   * Clave que el terminal genera una vez por devolución y repite en los reintentos. Si la
   * devolución ya se registró con esta clave, se devuelve el mismo resultado.
   */
  @IsOptional()
  @Matches(IDEMPOTENCY_KEY_RE, {
    message: 'La clave de la devolución no es válida.',
  })
  idempotencyKey?: string;
}
