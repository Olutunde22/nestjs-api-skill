# Validation & DTOs

## Global pipe

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

- **`whitelist: true` is load-bearing.** Properties without a validation decorator are stripped,
  so a client can't set `role`, `isAdmin` or `ownerId` by adding it to the body.
- `forbidNonWhitelisted: true` turns stripping into a 400. Stricter and noisier for clients
  that send extra fields; pick one per project and keep it.
- `transform: true` gives handlers real DTO instances and real numbers for numeric params.
- `enableImplicitConversion` converts query strings by the declared type. **Booleans are the
  trap:** `'false'` is a non-empty string and converts to `true`. Parse booleans explicitly
  (see below).
- NestJS 12 adds `errorFormat: 'list' | 'grouped'` for the shape of validation messages. The
  envelope's `message` is an array either way; pick one and document it in `api-responses.ts`.

## DTO rules

- **A concrete class per body and per query.** `ValidationPipe` reads the parameter's runtime
  type. Interfaces, type aliases and generics are erased, so nothing is validated.
- **Import DTOs by value.** `import type { CreateThingDto }` is erased at runtime and silently
  disables validation for that parameter.
- **Every property has a validator.** Under `whitelist`, a property without one is stripped, and
  that's how "the field never saves" bugs happen.
- **Optional but not nullable:** `@IsOptional()` skips validation for `null` as well as
  `undefined`, so `{"title": null}` passes and can write `NULL`. For "may be omitted, may not be
  null", use `@ValidateIf((_, v) => v !== undefined)` instead of `@IsOptional()`.
- **Nested objects:** `@ValidateNested()` + `@Type(() => ChildDto)`; arrays of them add
  `{ each: true }`.
- **Constrain sizes:** `@MaxLength` on strings, `@ArrayMaxSize` on arrays, `@Max` on numbers.
  Unbounded input is a cheap denial of service.
- **Enums from a const or TS enum**, validated with `@IsEnum`/`@IsIn`, documented with
  `enum` + `enumName`.

```ts
export class CreateThingDto {
  @ApiProperty({ example: 'Lagos rooftop' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Monthly meetup' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: THING_STATUSES, enumName: 'ThingStatus' })
  @IsIn(THING_STATUSES)
  status: ThingStatus;
}
```

## Update DTOs

Derive them; don't hand-copy fields:

```ts
import { OmitType, PartialType } from '@nestjs/swagger';

export class UpdateThingDto extends PartialType(OmitType(CreateThingDto, ['status'] as const)) {}
```

Import mapped types from **`@nestjs/swagger`** in a Swagger app (they keep the OpenAPI
metadata). Remove from the update DTO any field that must not change after creation, rather
than ignoring it in the service: what isn't in the DTO is stripped by the pipe.

## Query DTOs

Extend the shared `PaginationQueryDto` (`page`, `pageSize`, `search`) and add filters:

```ts
export class QueryThingsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: THING_STATUSES, enumName: 'ThingStatus' })
  @IsOptional()
  @IsIn(THING_STATUSES)
  status?: ThingStatus;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  archived?: boolean;
}
```

- Cap `pageSize` with `@Max(100)`; the service also clamps it.
- Any filter that would let a caller sort or search by a sensitive column is gated on the same
  permission that reveals that column — searching a column is reading it.

## Route params

- `ParseUUIDPipe` on `:id` when ids are UUIDs: `@Param('id', ParseUUIDPipe) id: string`. A
  malformed id becomes a 400 instead of a database error.
- `ParseIntPipe`, `ParseBoolPipe`, `ParseArrayPipe({ items: Number, separator: ',' })` for the rest.
- Bulk bodies: `@Body(new ParseArrayPipe({ items: CreateThingDto })) items: CreateThingDto[]`.

## Custom validators

Put reusable rules in `common/validators/` as `@ValidatorConstraint` classes with a decorator
factory (e.g. `IsUsernameOrEmail`, `MatchesProperty('password')`). Keep them pure; a validator
that queries the database (uniqueness) belongs in the service, which can throw a 409 with a
useful message and is safe under concurrency only when backed by a unique index.

## Custom param decorators

`ValidationPipe` skips arguments from custom param decorators (e.g. `@CurrentUser()`) unless
`validateCustomDecorators: true`. That's normally what you want: the user comes from a trusted
guard, not the client.

## NestJS 12: Standard Schema

v12 adds `StandardSchemaValidationPipe` and a `schema` option on `@Body()`, `@Query()` and
`@Param()`, so Zod/Valibot/ArkType schemas can replace class-validator:

```ts
const createThingSchema = z.object({ name: z.string().max(120), description: z.string().max(2000).optional() });
type CreateThingInput = z.infer<typeof createThingSchema>;

@Post()
create(@Body({ schema: createThingSchema }) body: CreateThingInput) {}
```

It's a project-wide choice (decision gate 3). If you take it, document request bodies from the
schema, keep the `*.doc.ts` files for responses, and don't leave half the DTOs on class-validator.
