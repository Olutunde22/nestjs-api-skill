import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { THING_STATUSES, type ThingStatus } from '../entities/thing.entity';

export class QueryThingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: THING_STATUSES, enumName: 'ThingStatus' })
  @IsOptional()
  @IsIn(THING_STATUSES)
  status?: ThingStatus;
}
