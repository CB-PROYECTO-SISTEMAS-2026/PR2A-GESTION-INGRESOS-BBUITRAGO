import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { toStrictInt } from '../../../common/validation/validators';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class MisEntradasQueryDto {
  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(toStrictInt)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Matches(DAY, { message: 'desde debe tener formato AAAA-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(DAY, { message: 'hasta debe tener formato AAAA-MM-DD' })
  hasta?: string;
}