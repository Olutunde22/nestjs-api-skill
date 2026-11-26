import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { AuthenticatedUser } from '../../common/types';
import { Thing } from './entities/thing.entity';
import { ThingsService } from './things.service';

const user: AuthenticatedUser = { id: 'u-1', username: 'ada', permissions: [] };

const makeRepo = () => ({
  findAndCount: jest.fn(),
  findOneBy: jest.fn(),
  existsBy: jest.fn().mockResolvedValue(false),
  create: jest.fn((input: Partial<Thing>) => input as Thing),
  save: jest.fn((thing: Thing) => Promise.resolve({ ...thing, id: thing.id ?? 't-1' })),
  remove: jest.fn(),
});

describe('ThingsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ThingsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ThingsService(repo as unknown as Repository<Thing>);
  });

  it('clamps the page size and returns the paginated shape', async () => {
    repo.findAndCount.mockResolvedValue([[], 0]);
    const result = await service.list({ page: 2, pageSize: 500 });
    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ skip: 100, take: 100 }));
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 100 });
  });

  it('throws 404 for an unknown id', async () => {
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('defaults status to draft and records the creator', async () => {
    const created = await service.create({ name: 'Rooftop' }, user);
    expect(created).toMatchObject({ name: 'Rooftop', status: 'draft', createdById: 'u-1' });
  });

  it('rejects a duplicate name before writing', async () => {
    repo.existsBy.mockResolvedValue(true);
    await expect(service.create({ name: 'Taken' }, user)).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('turns a unique violation that raced past the pre-check into a 409', async () => {
    const driverError = Object.assign(new Error('duplicate key'), { code: '23505' });
    repo.save.mockRejectedValue(new QueryFailedError('INSERT', [], driverError));
    await expect(service.create({ name: 'Raced' }, user)).rejects.toBeInstanceOf(ConflictException);
  });
});
