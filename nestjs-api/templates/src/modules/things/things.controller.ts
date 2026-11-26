import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions';
import { AuthenticatedUser } from '../../common/types';
import { CreateThingDto } from './dto/create-thing.dto';
import { QueryThingsDto } from './dto/query-things.dto';
import { UpdateThingDto } from './dto/update-thing.dto';
import {
  CreateThingDoc,
  DeleteThingDoc,
  GetThingDoc,
  ListThingsDoc,
  UpdateThingDoc,
} from './things.doc';
import { ThingsService } from './things.service';

// Each method: route, permission, audit (mutations), one doc decorator, one service call.
@ApiTags('Things')
@ApiCookieAuth()
@Controller('things')
export class ThingsController {
  constructor(private readonly things: ThingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.THINGS_READ)
  @ListThingsDoc()
  list(@Query() query: QueryThingsDto) {
    return this.things.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.THINGS_READ)
  @GetThingDoc()
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.things.get(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.THINGS_WRITE)
  @Audit({ action: 'thing.create', resourceType: 'thing' })
  @CreateThingDoc()
  create(@Body() dto: CreateThingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.things.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.THINGS_WRITE)
  @Audit({ action: 'thing.update', resourceType: 'thing', resourceIdParam: 'id' })
  @UpdateThingDoc()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateThingDto) {
    return this.things.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.THINGS_WRITE)
  @Audit({ action: 'thing.delete', resourceType: 'thing', resourceIdParam: 'id' })
  @DeleteThingDoc()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.things.remove(id);
  }
}
