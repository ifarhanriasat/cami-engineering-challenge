import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CLASSIFICATION_CATEGORIES } from '../classifier-provider';
import { MAX_MESSAGE_LENGTH } from '../classification-rules';
import { REQUEST_STATUSES, RequestStatus } from '../customer-request.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRequestDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message!: string;
}

export class UpdateStatusDto {
  @IsIn(REQUEST_STATUSES)
  status!: RequestStatus;
}

export class ClassifyDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message!: string;

  @IsOptional()
  @IsUUID()
  requestId?: string;
}

export class HistoryQueryDto {
  @IsOptional()
  @IsIn(CLASSIFICATION_CATEGORIES)
  category?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
