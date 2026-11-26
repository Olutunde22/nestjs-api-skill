---
name: nestjs-api
description: >-
  Bootstrap a new NestJS REST API, or refactor an existing one, onto a proven backend
  architecture: thin controllers over services, one feature folder per module, a typed
  success/error response envelope applied by a global interceptor and exception filter,
  global authentication with an explicit @Public() opt-out, permission-based authorization
  with denials recorded, class-validator DTOs on a whitelisting ValidationPipe, typed and
  validated configuration that refuses to boot on a missing secret, built-in security headers
  and CSRF protection, an exact CORS allowlist, rate limiting with a strict preset for
  credential endpoints, credential stripping from every response, TypeORM with
  migrations (never synchronize) and optional read-only data sources, external services
  behind an injected interface, and Swagger documentation kept out of controllers in one
  `<feature>.doc.ts` file per module whose decorators are composed with applyDecorators.
  Use when starting a NestJS project, adding a feature module (entity → DTOs → service →
  doc → controller → tests), documenting endpoints in Swagger, auditing an existing NestJS
  codebase against these patterns, or deciding where auth, validation, errors, or
  persistence logic belongs.
metadata:
  author: Olutunde22
  version: '1.0.0'
  nestjs: '12'
---

# NestJS API — architecture skill

A generic, project-agnostic encoding of a production NestJS REST architecture. Two modes:

- **Bootstrap** — a new API, or a new feature module in an API already on these patterns.
- **Refactor** — an existing NestJS codebase being moved onto them one module at a time.

Nothing here is domain-specific. Templates use the noun `Thing`/`things`; substitute your
own. Where a project must choose (envelope shape, auth mechanism, validation library, module
system), the choice is surfaced in the Decision gate rather than assumed.

**Always on the latest packages.** New projects install the current major of every
`@nestjs/*` package and its peers (NestJS 12 at the time of writing). The templates
type-check and their tests pass against the versions in `references/packages.md`. Read it
before installing anything.

## Hard gate

Before writing implementation code:

1. Read this file end-to-end.
2. Answer the **Decision gate** and record the answers in the project's `CLAUDE.md`/`AGENTS.md`.
3. Load the `references/` file for the layer you're touching. Do not guess at a pattern whose
   reference you haven't read.

Skipping causes the failures this architecture exists to prevent: routes that are public by
accident, request bodies that write fields nobody validated, a 500 that leaks a stack trace or
SQL, Swagger that drifts from the real responses, and a schema change shipped through
`synchronize` that drops production data.

## Decision gate

These choices cascade across every module. Settle them **before** generating anything. If the
project already exists, read the answers out of the code rather than asking.

| # | Question | Options | Cascades into |
|---|----------|---------|---------------|
| 1 | **Module system** (always the latest NestJS) | CommonJS · ESM | imports (`.js` suffix under ESM), test runner, Node minimum |
| 2 | **Response envelope** | `{ success, data, pagination? }` / `{ success:false, statusCode, message, … }` · `{ statusCode, message, success, data }` · raw bodies | interceptor, filter, every `*.doc.ts` example, clients |
| 3 | **Validation** | class-validator DTOs + `ValidationPipe` · Standard Schema (Zod/Valibot) + `StandardSchemaValidationPipe` | every DTO, Swagger property docs, mapped types |
| 4 | **Auth mechanism** | Passport JWT (cookie and/or bearer) · `@nestjs/authentication` · external IdP JWT | global guard, `@Public()`, login/refresh, Swagger auth scheme |
| 5 | **Authorization** | permission registry + `@RequirePermissions` · role enum · none | guard, seeds, every protected route |
| 6 | **Audit trail** | `@Audit` + interceptor (mutations, denials) · logging only · none | interceptor, audit table, guards |
| 7 | **Persistence** | TypeORM + migrations · Prisma · none | entities, repositories, tests |
| 8 | **Extra data sources** | single DB · additional read-only source(s) · several read/write | `DatabaseModule`, `@InjectRepository(Entity, name)` |
| 9 | **Config validation** | Joi (≥ 18) · Zod/Standard Schema · class-validator `validate()` | `config/validation.ts`, boot behaviour |
| 10 | **Test runner** | Jest (CommonJS default) · Vitest (ESM default) | specs, e2e config, CI |
| 11 | **Package manager** | bun · pnpm · npm | scripts, CI, lockfile |

Defaults when a project has no opinion: **1** CommonJS, **2** first option, **3**
class-validator, **4** Passport JWT in an httpOnly cookie with bearer fallback, **5**
permission registry, **6** `@Audit` on mutations, **7** TypeORM + migrations, **8** single DB,
**9** Joi, **10** Jest.

> Question 3 shapes Swagger. The `*.doc.ts` pattern documents *responses* the same way under
> both options, but request bodies are documented by `@ApiProperty` on class DTOs (or the CLI
> plugin) and by the schema itself under Standard Schema. Don't mix both in one codebase.

## What you can opt out of

### Optional — drop these freely

| Layer | Opting out means | Cost |
|---|---|---|
| **Audit trail** | No `@Audit`, no `AuditInterceptor` | No record of who changed what. Retrofitting means touching every mutation. |
| **Permission registry** | Authenticated = authorized | Fine for single-role APIs. Retrofitting is invasive, so decide honestly. |
| **Read-only data sources** | One DataSource | Lose the guarantee that a reporting DB is never written. |
| **External-service seam** | Call the HTTP client directly from services | Unit tests need network mocks; no stub while the other side is unbuilt. |
| **Health checks** | No `/health` | Orchestrators can't tell live from ready. |
| **Swagger CLI plugin** | Write every `@ApiProperty` by hand | More decorators, nothing breaks. |

Templates mark optional pieces with `OPTIONAL (decision gate N)` comments. Delete the piece,
keep the rest.

### Load-bearing — opting out is a bug

- **Global auth guard with an explicit `@Public()` opt-out.** Opt-in auth means every new route
  is public until someone remembers.
- **`ValidationPipe({ whitelist: true, transform: true })`** globally, and a DTO class for every
  body and query. Without `whitelist` a client can set any column the entity has.
- **A catch-all exception filter that never returns internals for non-HTTP errors.** Stack
  traces, SQL and provider messages go to the log, never to the client.
- **`synchronize: false` with migrations.** `synchronize` alters production schemas from entity
  diffs and can drop columns with data in them.
- **Config validated at boot, with secrets required outside development.** An empty signing
  secret that "disables verification" is an open door, not a default.
- **Guards before business logic.** Authorization lives in guards and services, never only in
  the client and never only in Swagger.
- **Concrete DTO classes imported by value.** Interfaces, generics and `import type` are erased
  at runtime, so the pipe validates nothing.
- **Security headers, an exact CORS allowlist, and CSRF protection when auth uses cookies.**
  `useSecurityHeaders()` and `enableCsrfProtection()` (built in since 12.1) are called first in
  setup; CORS never uses `origin: true` with credentials; CSRF trusts the same allowlist.
- **Rate limiting as the first global guard,** with `@StrictThrottle()` on every credential and
  messaging endpoint, and `trust proxy` set behind a load balancer.
- **Credential stripping on every response.** `StripCredentialsInterceptor` removes passwords,
  hashes, OTPs, PINs, secrets, keys and tokens at any depth; a route exposes one only by naming
  it with `@ExposeCredentials(...)`.

If a project wants to skip one of these, that's a correctness discussion, not a configuration
choice. Say so plainly rather than quietly complying.

## The core rule (controllers and docs)

**A controller method is three things: route decorators, one doc decorator, one service call.**
No business logic, no repository access, no `try/catch`, and no inline Swagger response blocks.

```ts
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

  @Post()
  @RequirePermissions(PERMISSIONS.THINGS_WRITE)
  @Audit({ action: 'thing.create', resourceType: 'thing' })
  @CreateThingDoc()
  create(@Body() dto: CreateThingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.things.create(dto, user);
  }
}
```

Every endpoint's Swagger lives in `things.doc.ts`, one exported decorator per endpoint, built
with `applyDecorators` from shared builders so the envelope is written once:

```ts
export const ListThingsDoc = () =>
  applyDecorators(
    ApiOperation({ summary: 'List things' }),
    ApiPaginatedOk('Things on this page.', [thingExample]),
    ApiErrorResponses(400, 401, 403),
  );
```

Non-negotiables:

- **One `<feature>.doc.ts` per module, one `XxxDoc()` per endpoint.** The controller reads like
  a routing table; the doc file reads like the API reference.
- **Examples match the real envelope.** Doc examples are built by the shared helpers in
  `common/docs/api-responses.ts`, which mirror the interceptor and filter. Change the envelope
  in one place and every doc follows.
- **Document every status the route can return**, including 401/403 from guards and 404/409
  from the service. A route that throws `ConflictException` and documents only 200 is lying.
- **Throw Nest HTTP exceptions from services** (`NotFoundException`, `ConflictException`, …);
  the filter shapes them. Never build error responses by hand.

## Build order

For a **new API**, in this order — each step boots before the next exists:

1. **Decision gate** answered and written down.
2. **Packages** — install the latest of everything in `references/packages.md`.
3. **Config** — `configuration.ts` + validation schema; the app refuses to boot without secrets.
4. **Bootstrap** — `app.setup.ts`, shared by `main.ts` and the e2e tests: trust proxy, security
   headers, CSRF, CORS, cookie parser, prefix, `ValidationPipe` — in that order. `main.ts` adds
   Swagger and shutdown hooks.
5. **Cross-cutting** — response interceptor, credential-stripping interceptor, exception filter,
   `common/docs/api-responses.ts`, rate limiting with the strict preset.
6. **Data** — `DatabaseModule`, first migration.
7. **Auth** — strategy, global guard, `@Public()`, `@CurrentUser()`, login/refresh/logout.
8. **Authorization + audit** — permission registry, guard, `@Audit` + interceptor.
9. **Health** — `/health/live` and `/health/ready` (excluded from the prefix and the envelope).
10. **First feature module** end-to-end, then the rest.

For a **feature module**, in this order:

1. **Entity** + migration.
2. **DTOs** — create, update (mapped types), query (pagination + filters).
3. **Service** — business rules, repository access, HTTP exceptions.
4. **Doc file** — one decorator per endpoint, every status documented.
5. **Controller** — route + guard decorators + doc decorator + one service call.
6. **Module** — `forFeature`, providers, exports; register in `AppModule`.
7. **Permissions** — new keys in the registry and its seed.
8. **Tests** — service unit tests, then one e2e for the critical path.

For a **refactor**, order by risk reduction, one module per review: global `ValidationPipe` +
exception filter first (cheap, immediately safer), then the global auth guard with `@Public()`,
then envelope + doc files, then permissions and audit, then config validation, then migrations
replacing `synchronize`.

## Layer rules

Load the matching reference before writing code in that layer.

| Layer | Reference | One-line rule |
|-------|-----------|---------------|
| Swagger docs | `references/swagger-docs.md` | One `*.doc.ts` per module; controllers carry one doc decorator per route. |
| Modules & DI | `references/modules-and-di.md` | Feature folders; external services behind an injected interface token. |
| Validation & DTOs | `references/validation.md` | Whitelist globally; a concrete DTO class for every body and query. |
| Responses & errors | `references/responses-and-errors.md` | One envelope, set by the interceptor and filter, never by hand. |
| Auth & permissions | `references/auth.md` | Authenticate globally, opt out with `@Public()`, authorize with permissions. |
| Data | `references/data.md` | Migrations, never `synchronize`; read-only sources are never written. |
| Config | `references/config.md` | Typed, validated at boot, secrets required outside development. |
| Testing | `references/testing.md` | Unit-test services with plain constructors; e2e with the real global setup. |
| Security & ops | `references/security-and-ops.md` | Headers, exact CORS allowlist, CSRF, rate limits, credential stripping, health, shutdown. |
| Packages | `references/packages.md` | Latest major of everything; all `@nestjs/*` on the same major. |

## Templates

`templates/` holds real, copyable files rather than prose — prose drifts, files can be diffed.

```
nest-cli.json                                 Swagger CLI plugin enabled
.env.example                                  every variable, safe placeholders
src/main.ts                                   bootstrap: Swagger, shutdown hooks, listen
src/app.setup.ts                              trust proxy, security headers, CSRF, CORS, prefix,
                                              ValidationPipe — shared with e2e
src/app.module.ts                             global guards (throttle → auth → permissions),
                                              interceptors, filter, in order
src/common/throttle.ts                        named throttlers + @StrictThrottle()
src/common/security/strip-credentials.ts      credential key matcher + deep strip (with spec)
src/common/interceptors/strip-credentials.interceptor.ts  strips credentials from every response
src/config/configuration.ts                   typed config object
src/config/validation.ts                      boot-time env validation (Joi)
src/common/types.ts                           AuthenticatedUser, Paginated<T>
src/common/permissions.ts                     permission registry + seed list
src/common/decorators/*.ts                    @Public, @CurrentUser, @RequirePermissions, @Audit,
                                              @SkipEnvelope, @ExposeCredentials
src/common/guards/jwt-auth.guard.ts           global authentication with @Public opt-out
src/common/guards/permissions.guard.ts        permission check, denial recorded
src/common/interceptors/response.interceptor.ts   success envelope + pagination lift
src/common/filters/all-exceptions.filter.ts   error envelope, no leaked internals
src/common/docs/api-responses.ts              shared Swagger builders for the envelope
src/common/dto/pagination-query.dto.ts        page/pageSize/search base DTO + pageOf()
src/database/database.module.ts               TypeORM, migrations, never synchronize
src/database/data-source.ts                   TypeORM CLI data source
src/health/                                   liveness + readiness with terminus
src/modules/auth/                             JWT strategy (cookie then bearer), cookie helpers
src/modules/audit/                            append-only audit log, interceptor, service
src/modules/things/                           a complete feature module:
  things.module.ts  things.controller.ts  things.service.ts  things.doc.ts
  dto/create-thing.dto.ts  dto/update-thing.dto.ts  dto/query-things.dto.ts
  entities/thing.entity.ts  things.service.spec.ts
test/things.e2e-spec.ts                       e2e with the same global setup as main.ts
```

Comments in templates are calibrated to teach: `LOAD-BEARING` marks something that breaks
correctness if removed, `OPTIONAL (decision gate N)` marks something you can delete. Strip
both once the file is in a real project; that codebase's comment conventions apply from then on.

## Anti-patterns

- Swagger response blocks inline on controller methods, or the same 400/401/500 examples
  copy-pasted into every doc decorator instead of the shared builders.
- Doc examples whose shape differs from what the interceptor actually returns.
- Business logic, repository calls, or `try/catch` in a controller.
- Returning `{ error: … }` objects from a service instead of throwing an HTTP exception.
- Opt-in authentication (`@UseGuards(AuthGuard)` per route) instead of a global guard.
- Branching on role names inline instead of checking a permission from the registry.
- `@Body() body: any`, `@Body() body: SomeInterface`, or `import type { SomeDto }`.
- `@IsOptional()` on a field that must never be `null` — it lets `null` through to the database.
- Mapped types imported from `@nestjs/mapped-types` in a Swagger app — use `@nestjs/swagger`.
- `synchronize: true` anywhere a real database is involved, or writing through a source that
  was meant to be read-only.
- `process.env.X` read outside `config/configuration.ts`.
- `origin: true` or `'*'` with `credentials: true`, or a CORS origin with a path or trailing slash.
- Cookie auth without CSRF protection, or CSRF `trustedOrigins` that don't include the CORS
  allowlist (your own frontend then gets 403s).
- `app.use(...)` middleware registered before `useSecurityHeaders()`/`enableCsrfProtection()`.
- A credential endpoint without `@StrictThrottle()`, or a strict throttler whose module-level
  `skipIf` silently disables it on every route.
- Returning an entity with its password hash, OTP or token, relying on nothing but the
  stripping interceptor — or adding `@ExposeCredentials` to silence it.
- A global filter registered with `app.useGlobalFilters(new X())` when it needs injected
  dependencies — register it with `APP_FILTER`.
- Registering a global guard with `useClass` and then being unable to override it in e2e —
  use `useExisting` for anything tests must replace.
- Letting this skill, the project's `CLAUDE.md`, or the doc files go stale after a pattern
  changes. Update them in the same change. Freshness order when they disagree:
  **code > CLAUDE.md > SKILL.md > references**.
