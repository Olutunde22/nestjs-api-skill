# Data (TypeORM)

## Connection

```ts
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>) => ({
    type: 'postgres',
    url: config.get('databaseUrl', { infer: true }),
    autoLoadEntities: true,
    synchronize: false,
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsRun: true,
  }),
}),
```

- **`synchronize: false`, always.** Turning it off only in production isn't enough either: then
  production has no tables. Every environment gets its schema from migrations.
- `migrationsRun: true` applies pending migrations at boot. With several replicas booting at
  once, prefer running migrations as a separate deploy step.
- `autoLoadEntities: true` registers every entity passed to `forFeature`. With several data
  sources, list entities explicitly per source instead (see below).
- Log the target host/db at connect time (never the password) so "connected to the wrong
  database" is visible in the first log lines.

## Migrations

- A `data-source.ts` for the TypeORM CLI, reading the same env vars as the app.
- `migration:generate` from entity changes, then **read the generated SQL** — it happily emits a
  `DROP COLUMN` + `ADD COLUMN` for a rename.
- Data backfills go in migrations too, written to be safe on a large table (batches, no full-table
  locks on hot tables).
- Never edit a migration that has run in a shared environment; add a new one.

## Entities

```ts
@Entity({ name: 'things' })
export class Thing {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 120 }) name: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
```

- `snake_case` column names via `name:`, camelCase properties.
- `timestamptz` for every timestamp. Store UTC; format at the edge.
- Money as integer minor units (`bigint`/`int`) or `numeric` with a transformer — never `float`.
- Secrets and hashes: `select: false`, and never in a response DTO or doc example.
- Uniqueness enforced by a **unique index**, not only a pre-check in the service.

## Repositories in services

```ts
constructor(@InjectRepository(Thing) private readonly things: Repository<Thing>) {}
```

- Only the owning module's service touches its repository.
- `findOne`/`findOneBy` return `null`; convert to `NotFoundException` in one `get(id)` method and
  reuse it.
- Paginate with `findAndCount({ skip, take, order })`, clamp `pageSize`, always order by a stable
  key (add `id` as a tiebreaker) so pages don't shuffle.
- Search with `ILike` on indexed columns; escape `%`/`_` in user input when it matters.
- Use the query builder for joins and aggregates; parameterize every value (`:name`), never
  interpolate.

## Transactions

```ts
await this.dataSource.transaction(async (manager) => {
  await manager.save(order);
  await manager.save(lines);
});
```

- Multi-row writes that must succeed together go in a transaction.
- Inside it, use `manager`, not the injected repositories (they're outside the transaction).
- Concurrency-sensitive updates (stock, balances, state machines) use a row lock
  (`setLock('pessimistic_write')`) or a conditional `UPDATE … WHERE state = :expected` and check
  the affected row count.
- Don't call external services inside a transaction; commit first, then call, then record the
  outcome.

## Extra data sources (decision gate 8)

```ts
TypeOrmModule.forRootAsync({ name: 'reporting', /* … */ entities: reportingEntities, synchronize: false, migrationsRun: false }),
TypeOrmModule.forFeature([Order], 'reporting'),
@InjectRepository(Order, 'reporting') private readonly orders: Repository<Order>,
```

A **read-only** source (another service's database you report on) has rules of its own:

- Connect with a database role that has `SELECT` only. The code convention isn't enough.
- No migrations, `synchronize: false`, entities mirror the other service's schema and may map only
  the columns you need.
- **Never write through it.** Changes to that data go through the owning service's API (via the
  injected client — see `modules-and-di.md`).
- List its entities explicitly and add a test that every entity file is registered: a forgotten
  one throws `EntityMetadataNotFoundError` only on first query, in production.

## Testing

- Unit tests construct the service with a fake repository object (`{ findOne: jest.fn() }`) or use
  `getRepositoryToken(Thing)` in a testing module.
- Migrations and query-heavy code get integration tests against a disposable real database (a
  container in CI). SQLite is not Postgres.
