import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { THING_STATUSES, type ThingStatus } from '../entities/thing.entity';

export class CreateThingDto {
  @ApiProperty({ example: 'Lagos rooftop meetup', maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Monthly meetup for builders.', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: THING_STATUSES, enumName: 'ThingStatus', default: 'draft' })
  @IsOptional()
  @IsIn(THING_STATUSES)
  status?: ThingStatus;
}
