import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EventoEstado, SolicitudEstado, TipoAcceso } from '@prisma/client';
import {
  IsGoogleMapsUrl,
  MAX_CAPACIDAD,
  emptyToUndefined,
  toStrictInt,
  trimString,
} from '../../../common/validation/validators';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CAPACIDAD_MESSAGE = `La capacidad máxima debe ser un número entero entre 1 y ${MAX_CAPACIDAD.toLocaleString('es-BO')}.`;
export const MAX_SERVICIOS = 30;
export const MAX_ACTIVIDADES = 30;

class ScheduleFields {
  @Matches(DAY, { message: 'Selecciona una fecha válida.' })
  fechaInicio: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DAY, { message: 'Selecciona una fecha de fin válida.' })
  fechaFin?: string;

  @Matches(TIME, { message: 'Indica una hora de inicio válida.' })
  horaInicio: string;

  @Matches(TIME, { message: 'Indica una hora de fin válida.' })
  horaFin: string;
}

export class ActividadDto {
  @Matches(TIME, { message: 'Cada actividad del cronograma necesita una hora válida.' })
  hora: string;

  @IsString()
  @Transform(trimString)
  @MinLength(2, { message: 'Describe cada actividad del cronograma (mínimo 2 caracteres).' })
  @MaxLength(120, { message: 'La descripción de una actividad no puede superar los 120 caracteres.' })
  actividad: string;
}

/** Solo las actividades intermedias: la apertura y el cierre salen de la hora de inicio y fin del evento. */
export class CronogramaDto {
  @IsArray()
  @ArrayMaxSize(MAX_ACTIVIDADES, { message: `El cronograma admite hasta ${MAX_ACTIVIDADES} actividades.` })
  @ValidateNested({ each: true })
  @Type(() => ActividadDto)
  actividades: ActividadDto[];
}

export class CreateSolicitudDto extends ScheduleFields {
  @IsString()
  @Transform(trimString)
  @MinLength(5, { message: 'El nombre del evento debe tener al menos 5 caracteres.' })
  @MaxLength(120)
  nombreEvento: string;

  @IsString()
  @Transform(trimString)
  @MinLength(20, { message: 'La descripción debe tener al menos 20 caracteres.' })
  @MaxLength(5000)
  descripcion: string;

  @IsString()
  @Transform(trimString)
  @MinLength(5, { message: 'Escribe la dirección o el nombre del lugar (mínimo 5 caracteres).' })
  @MaxLength(191)
  ubicacion: string;

  @Transform(trimString)
  @IsGoogleMapsUrl()
  @MaxLength(500)
  ubicacionUrl: string;

  @Transform(toStrictInt)
  @IsInt({ message: CAPACIDAD_MESSAGE })
  @Min(1, { message: CAPACIDAD_MESSAGE })
  @Max(MAX_CAPACIDAD, { message: CAPACIDAD_MESSAGE })
  capacidad: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  empresa?: string;
}

export class RevisarSolicitudDto {
  @IsIn([SolicitudEstado.APROBADA, SolicitudEstado.RECHAZADA], {
    message: 'Estado debe ser APROBADA o RECHAZADA',
  })
  estado: SolicitudEstado;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;
}

export class ListSolicitudesQuery {
  @IsOptional()
  @IsEnum(SolicitudEstado)
  estado?: SolicitudEstado;
}

export class CreateEventoDto extends ScheduleFields {
  @IsOptional()
  @IsString()
  solicitudId?: string;

  @ValidateIf((o: CreateEventoDto) => !o.solicitudId)
  @IsString({ message: 'Selecciona el organizador del evento' })
  organizadorId?: string;

  @IsString()
  @Transform(trimString)
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres.' })
  @MaxLength(191)
  titulo: string;

  @IsString()
  @Transform(trimString)
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres.' })
  @MaxLength(5000)
  descripcion: string;

  @IsString()
  @Transform(trimString)
  @MinLength(3, { message: 'Escribe la dirección o el nombre del lugar.' })
  @MaxLength(191)
  ubicacion: string;

  @Transform(trimString)
  @IsGoogleMapsUrl()
  @MaxLength(500)
  ubicacionUrl: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SERVICIOS, { message: `Puedes agregar hasta ${MAX_SERVICIOS} servicios.` })
  @IsString({ each: true })
  @MaxLength(80, { each: true, message: 'Cada servicio puede tener hasta 80 caracteres.' })
  servicios?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CronogramaDto)
  cronograma?: CronogramaDto;

  @IsOptional()
  @IsEnum(TipoAcceso, { message: 'Selecciona un tipo de acceso válido.' })
  tipoAcceso?: TipoAcceso;

  @IsOptional()
  @IsEnum(EventoEstado, { message: 'Selecciona un estado válido.' })
  estado?: EventoEstado;

  @Transform(toStrictInt)
  @IsInt({ message: CAPACIDAD_MESSAGE })
  @Min(1, { message: CAPACIDAD_MESSAGE })
  @Max(MAX_CAPACIDAD, { message: CAPACIDAD_MESSAGE })
  capacidad: number;
}

export class UpdateEventoDto {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MinLength(3, { message: 'El título debe tener al menos 3 caracteres.' })
  @MaxLength(191)
  titulo?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MinLength(10, { message: 'La descripción debe tener al menos 10 caracteres.' })
  @MaxLength(5000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MinLength(3, { message: 'Escribe la dirección o el nombre del lugar.' })
  @MaxLength(191)
  ubicacion?: string;

  @IsOptional()
  @Transform(trimString)
  @IsGoogleMapsUrl()
  @MaxLength(500)
  ubicacionUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SERVICIOS, { message: `Puedes agregar hasta ${MAX_SERVICIOS} servicios.` })
  @IsString({ each: true })
  @MaxLength(80, { each: true, message: 'Cada servicio puede tener hasta 80 caracteres.' })
  servicios?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CronogramaDto)
  cronograma?: CronogramaDto;

  @IsOptional()
  @IsEnum(TipoAcceso, { message: 'Selecciona un tipo de acceso válido.' })
  tipoAcceso?: TipoAcceso;

  @IsOptional()
  @IsEnum(EventoEstado, { message: 'Selecciona un estado válido.' })
  estado?: EventoEstado;

  @IsOptional()
  @Transform(toStrictInt)
  @IsInt({ message: CAPACIDAD_MESSAGE })
  @Min(1, { message: CAPACIDAD_MESSAGE })
  @Max(MAX_CAPACIDAD, { message: CAPACIDAD_MESSAGE })
  capacidad?: number;

  @IsOptional()
  @Matches(DAY, { message: 'Selecciona una fecha válida.' })
  fechaInicio?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DAY, { message: 'Selecciona una fecha de fin válida.' })
  fechaFin?: string;

  @IsOptional()
  @Matches(TIME, { message: 'Indica una hora de inicio válida.' })
  horaInicio?: string;

  @IsOptional()
  @Matches(TIME, { message: 'Indica una hora de fin válida.' })
  horaFin?: string;
}

export class UpdateMapaDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  nota?: string;
}
