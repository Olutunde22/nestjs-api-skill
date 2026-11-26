import { PartialType } from '@nestjs/swagger';
import { CreateThingDto } from './create-thing.dto';

// From @nestjs/swagger, not @nestjs/mapped-types, so the derived class keeps its OpenAPI metadata.
export class UpdateThingDto extends PartialType(CreateThingDto) {}
