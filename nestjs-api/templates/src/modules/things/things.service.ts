import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from 'typeorm';
import { pageOf } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser, Paginated } from '../../common/types';
import { CreateThingDto } from './dto/create-thing.dto';
import { QueryThingsDto } from './dto/query-things.dto';
import { UpdateThingDto } from './dto/update-thing.dto';
import { Thing } from './entities/thing.entity';

const PG_UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (err: unknown): boolean =>
  err instanceof QueryFailedError &&
  (err.driverError as { code?: string } | undefined)?.code === PG_UNIQUE_VIOLATION;

@Injectable()
export class ThingsService {
  constructor(@InjectRepository(Thing) private readonly things: Repository<Thing>) {}

  async list(query: QueryThingsDto): Promise<Paginated<Thing>> {
    const { page, pageSize, skip, take } = pageOf(query);
    const filter: FindOptionsWhere<Thing> = query.status ? { status: query.status } : {};
    const where = query.search
      ? [
          { ...filter, name: ILike(`%${query.search}%`) },
          { ...filter, description: ILike(`%${query.search}%`) },
        ]
      : filter;

    const [items, total] = await this.things.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
      skip,
      take,
    });
    return { items, total, page, pageSize };
  }

  async get(id: string): Promise<Thing> {
    const thing = await this.things.findOneBy({ id });
    if (!thing) {
      throw new NotFoundException('Thing not found');
    }
    return thing;
  }

  async create(dto: CreateThingDto, user: AuthenticatedUser): Promise<Thing> {
    await this.assertNameFree(dto.name);
    try {
      return await this.things.save(
        this.things.create({
          name: dto.name,
          description: dto.description ?? null,
          status: dto.status ?? 'draft',
          createdById: user.id,
        }),
      );
    } catch (err) {
      throw this.translate(err);
    }
  }

  async update(id: string, dto: UpdateThingDto): Promise<Thing> {
    const thing = await this.get(id);
    if (dto.name !== undefined && dto.name !== thing.name) {
      await this.assertNameFree(dto.name);
      thing.name = dto.name;
    }
    if (dto.description !== undefined) thing.description = dto.description;
    if (dto.status !== undefined) thing.status = dto.status;
    try {
      return await this.things.save(thing);
    } catch (err) {
      throw this.translate(err);
    }
  }

  async remove(id: string): Promise<void> {
    const thing = await this.get(id);
    await this.things.remove(thing);
  }

  private async assertNameFree(name: string): Promise<void> {
    if (await this.things.existsBy({ name })) {
      throw new ConflictException('A thing with this name already exists');
    }
  }

  // The pre-check races with concurrent writes; the unique index is the real guarantee.
  private translate(err: unknown): unknown {
    return isUniqueViolation(err)
      ? new ConflictException('A thing with this name already exists')
      : err;
  }
}
