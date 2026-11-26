# Swagger docs — one `*.doc.ts` per module

Controllers stay readable when Swagger lives somewhere else. Every feature module gets a
`<feature>.doc.ts` file that exports one decorator per endpoint. Each decorator is a
composition built with `applyDecorators` from `@nestjs/common`, and each controller method
carries exactly one of them.

```
src/modules/things/
  things.controller.ts   routing table: @Get/@Post, guards, @ThingDoc(), one service call
  things.doc.ts          API reference: operation, params, every response with an example
```

## Why this shape

- **The controller reads like a routing table.** Route, permission, audit, doc, service call.
  Nothing else competes for attention, so a missing guard is easy to spot in review.
- **The doc file reads like the API reference.** All of a module's responses sit together,
  which makes it obvious when two endpoints describe the same thing differently.
- **Examples are concrete.** Consumers (frontend, mobile, other services) read real-looking
  payloads in the envelope they will actually receive, not just a schema tree.
- **The envelope is written once.** Shared builders in `common/docs/api-responses.ts` wrap
  each example in the envelope the `ResponseInterceptor` and `AllExceptionsFilter` produce.

## The basic form

The simplest form — a decorator per endpoint, each response with an example in the envelope:

```ts
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

export const GetCurrentUserDoc = (): MethodDecorator =>
  applyDecorators(
    ApiResponse({
      status: 200,
      description: 'Successfully retrieved current user.',
      schema: {
        example: {
          success: true,
          data: { id: '248c5878-…', fullName: 'Ada Obi', email: 'ada@example.com' },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized',
      schema: { example: { success: false, statusCode: 401, message: 'Unauthorized' } },
    }),
  );
```

```ts
@Get('me')
@GetCurrentUserDoc()
me(@CurrentUser() user: AuthenticatedUser) {
  return this.users.me(user.id);
}
```

This works, but written this way every decorator repeats the 400/401/403/500 blocks and the
envelope keys. After ten endpoints those copies disagree. Use the shared builders instead.

## The shared builders

`templates/src/common/docs/api-responses.ts` exports a small set of builders. Each one wraps a
payload example in the envelope and returns a decorator:

| Builder | Produces |
|---|---|
| `ApiOk(description, example, status = 200)` | `{ success: true, data: example }` |
| `ApiCreated(description, example)` | same, status 201 |
| `ApiPaginatedOk(description, items)` | `{ success: true, data: items, pagination: { total, page, pageSize } }` |
| `ApiNoContent(description)` | 204, no body |
| `ApiErrorResponses(...statuses)` | one documented error per status, each in the error envelope |
| `ApiErrorResponse(status, message, description?)` | one error with a route-specific message |

With them, a doc decorator is a few lines and only says what is specific to that endpoint:

```ts
export const CreateThingDoc = () =>
  applyDecorators(
    ApiOperation({ summary: 'Create a thing' }),
    ApiCreated('The created thing.', thingExample),
    ApiErrorResponse(409, 'A thing with this name already exists'),
    ApiErrorResponses(400, 401, 403),
  );
```

`ApiErrorResponses` carries a default message per status (`400 → ['name must be a string']`,
`401 → 'Unauthorized'`, `403 → 'Insufficient permissions'`, `404 → 'Not found'`,
`500 → 'Internal server error'`). Use `ApiErrorResponse` when the route has a specific message
worth showing, such as the 409 above.

## What each doc decorator contains

In this order, so every file scans the same way:

1. `ApiOperation({ summary, description? })` — `summary` is one short imperative line; add
   `description` only when the route has a rule a caller must know (what makes it 409, what a
   flag changes).
2. Parameters the plugin can't infer — `ApiParam`, `ApiQuery` with `enum`/`enumName`,
   `ApiBody` only when the body isn't a DTO class, `ApiConsumes('multipart/form-data')` for
   uploads.
3. The success response — `ApiOk`, `ApiCreated`, `ApiPaginatedOk` or `ApiNoContent`.
4. Route-specific errors — `ApiErrorResponse(404, …)`, `ApiErrorResponse(409, …)`.
5. The guard and validation errors — `ApiErrorResponses(400, 401, 403)`.

Put `ApiTags` and the auth scheme (`ApiCookieAuth()` / `ApiBearerAuth()`) on the **controller
class**, not in each doc decorator. Public routes in an authenticated controller can say so in
their `description`.

## Examples

- **Keep one example object per resource** at the top of the doc file (`const thingExample =
  {...}`) and reuse it across that module's decorators. List, detail, create and update then
  agree on the shape by construction.
- **Make examples realistic and fake.** Plausible ids (`'0f8fad5b-d9cb-469f-a165-70867728950e'`),
  ISO timestamps, `example.com` emails. Never paste real customer data or real secrets.
- **Match the serialized shape**, not the entity class: dates as ISO strings, no fields the
  service strips (password hashes, `select: false` columns), camelCase if that's what the
  API returns.
- **Annotate typed responses when a client generator consumes the spec.** Examples document;
  they don't type. If the frontend generates clients from the OpenAPI JSON, give success
  responses a `type` (a response DTO class) as well as the example. See *Typed responses* below.

## Pagination

The interceptor lifts a service result shaped `{ items, total, page, pageSize }` into
`{ success: true, data: items, pagination: { total, page, pageSize } }`. Document it with
`ApiPaginatedOk(description, [example])`; the builder fills the `pagination` block. Query
params come from the query DTO (which extends `PaginationQueryDto`), so the plugin documents
`page`, `pageSize` and filters without extra decorators.

## Typed responses (when the spec feeds code generation)

Example-only docs give readers a payload but give generators `object`. When the OpenAPI JSON
generates a typed client, also document a response class. For a generic paginated wrapper,
follow the official pattern — register the models with `ApiExtraModels` and compose with
`allOf` + `getSchemaPath`:

```ts
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(model: TModel) =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          { properties: { data: { type: 'array', items: { $ref: getSchemaPath(model) } } } },
        ],
      },
    }),
  );
```

Choose one approach per project and say which in `CLAUDE.md`: example-first (this skill's
default) or type-first. Mixing them leaves some endpoints typed and others not.

## Bootstrap

```ts
const config = new DocumentBuilder()
  .setTitle('Things API')
  .setDescription('…')
  .setVersion(process.env.npm_package_version ?? '0.0.0')
  .addCookieAuth(accessCookieName) // or .addBearerAuth()
  .build();
const documentFactory = () => SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, documentFactory, {
  jsonDocumentUrl: 'docs/json',
  swaggerOptions: { persistAuthorization: true },
});
```

- Pass a **factory** to `setup`, so the document is only built when first requested.
- Serve the JSON (`jsonDocumentUrl`) — client generators and contract tests consume it.
- Decide per environment whether `/docs` is exposed. Internal APIs often serve it everywhere;
  public APIs often hide it in production or put it behind auth.

## The CLI plugin

Enable it in `nest-cli.json` so DTO properties are documented from their TypeScript types:

```json
{
  "compilerOptions": {
    "plugins": [
      { "name": "@nestjs/swagger", "options": { "classValidatorShim": true, "introspectComments": true } }
    ]
  }
}
```

- It scans `*.dto.ts` and `*.entity.ts` for properties and `*.controller.ts` for routes. The
  `*.doc.ts` files aren't scanned and don't need to be — they're explicit by design.
- `classValidatorShim` copies `@Max(10)`, `@IsOptional()` etc. into the schema.
- `introspectComments` turns `/** comment */` on a DTO property into its description.
- An explicit `@ApiProperty()` / `@ApiQuery()` always wins over what the plugin infers. Use one
  for enums (`enum` + `enumName`, so the enum becomes a reusable schema) and for examples.
- `ts-jest` doesn't run the plugin. If e2e tests assert on the generated document, configure the
  plugin's AST transformer for `ts-jest`.

## DTO documentation rules

- `@ApiProperty({ example })` on required fields, `@ApiPropertyOptional()` on optional ones
  (or rely on the plugin and add only `example`).
- Arrays: `@ApiProperty({ type: [String] })`.
- Enums: `@ApiProperty({ enum: ThingStatus, enumName: 'ThingStatus' })`.
- Derive update DTOs with mapped types **from `@nestjs/swagger`**
  (`PartialType`, `PickType`, `OmitType`, `IntersectionType`) so the derived class keeps its
  Swagger metadata. Importing them from `@nestjs/mapped-types` loses it.

## Checklist for a new endpoint

- [ ] A `XxxDoc()` export in the module's `*.doc.ts`, applied to the controller method.
- [ ] `ApiOperation` summary present.
- [ ] Success response uses the shared builder and the module's example object.
- [ ] Every exception the service can throw has a documented status.
- [ ] 400/401/403 documented unless the route is `@Public()` or takes no input.
- [ ] Example contains no real data and matches the serialized shape.
