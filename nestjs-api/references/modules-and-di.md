# Modules & dependency injection

## Layout

```
src/
  main.ts                 bootstrap only
  app.module.ts           imports feature modules; registers global guards/interceptors/filter
  config/                 configuration.ts (typed object) + validation.ts (env schema)
  common/                 cross-cutting, no feature knowledge
    decorators/  guards/  interceptors/  filters/  docs/  dto/  validators/
    permissions.ts  types.ts
  database/               DatabaseModule, data-source.ts (CLI), migrations/, seeds/
  modules/
    <feature>/
      <feature>.module.ts
      <feature>.controller.ts
      <feature>.service.ts
      <feature>.doc.ts
      dto/        create-*.dto.ts  update-*.dto.ts  query-*.dto.ts
      entities/   *.entity.ts
      *.spec.ts
  health/                 health controller (excluded from prefix and envelope)
test/                     e2e specs
```

Rules:

- **One feature per folder.** A feature owns its entities, DTOs, service, controller and docs.
  Another feature that needs its data imports the module and calls the exported **service**,
  never its repository.
- **`common/` knows no feature.** If a helper needs a feature's entity, it belongs in that feature.
- **Name files by role:** `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.doc.ts`,
  `*.dto.ts`, `*.entity.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.filter.ts`, `*.decorator.ts`.
  The Swagger CLI plugin keys on the `.dto.ts`/`.entity.ts`/`.controller.ts` suffixes.

## Controllers, services, and where logic goes

| Concern | Lives in |
|---|---|
| Routing, HTTP verb, status code (`@HttpCode`) | controller |
| Who may call it | guard + `@RequirePermissions` on the controller |
| Shape and validity of input | DTO + global `ValidationPipe` |
| Business rules, existence checks, conflicts | service (throws HTTP exceptions) |
| Persistence | service via injected repository / DataSource |
| Response envelope, error shape | interceptor / filter |
| Swagger | `<feature>.doc.ts` |

A service may throw `NotFoundException`/`ConflictException`/`BadRequestException`. That couples
it lightly to HTTP, which is the pragmatic choice for a REST API. If the same service is also
driven by a queue or CLI, throw domain errors instead and map them in a filter.

## Module definition

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Thing])],
  providers: [ThingsService],
  controllers: [ThingsController],
  exports: [ThingsService],
})
export class ThingsModule {}
```

- Export the **service**, not `TypeOrmModule`, unless another module genuinely needs the raw
  repository (rare, and a smell).
- `@Global()` only for genuinely cross-cutting infrastructure (audit, an outbound API client,
  notifications). Feature modules are never global.
- Register every feature module in `AppModule.imports`.

## External services behind an injected interface

Anything outside the process — another internal API, a payment provider, an email service — is
reached through an **interface + injection token**, never by a service calling `fetch` directly.

```ts
export interface PaymentsClient {
  refund(input: RefundInput): Promise<RefundResult>;
}
export const PAYMENTS_CLIENT = Symbol('PAYMENTS_CLIENT');
```

```ts
@Global()
@Module({
  providers: [
    PaymentsHttpClient,
    PaymentsStubClient,
    {
      provide: PAYMENTS_CLIENT,
      inject: [ConfigService, PaymentsHttpClient, PaymentsStubClient],
      useFactory: (config: ConfigService<AppConfig, true>, http: PaymentsHttpClient, stub: PaymentsStubClient) =>
        config.get('payments', { infer: true }).baseUrl ? http : stub,
    },
  ],
  exports: [PAYMENTS_CLIENT],
})
export class PaymentsModule {}
```

```ts
constructor(@Inject(PAYMENTS_CLIENT) private readonly payments: PaymentsClient) {}
```

Why:

- Unit tests pass a plain object implementing the interface — no network mocking.
- A **stub** implementation lets you build and demo a flow before the other side ships.
- When the other side ships some endpoints but not others, a **hybrid** implementation routes
  per method (real HTTP for what exists, stub for what doesn't). Move methods across as they
  ship; there is no global "stub mode" switch to forget in production.
- The HTTP implementation is the single place that signs requests, sets timeouts, maps the
  remote error into an `HttpException`, and translates casing (e.g. camelCase ↔ snake_case).
  Pin the wire body in a unit test: a silently dropped field is the typical failure.

## Injection tokens and scopes

- Prefer class tokens; use a `Symbol` (or string constant) only for interfaces and config.
- Keep providers singleton (the default). Request-scoped providers propagate the scope up the
  whole injection chain and cost an instance per request; reach for `@Inject(REQUEST)` only when
  there's no other way (e.g. multi-tenant connection selection).
- Avoid circular module imports. If two modules need each other, extract the shared part into a
  third module; `forwardRef` is a last resort.

## `main.ts` stays thin

Bootstrap does framework wiring only. `app.setup.ts` (shared with e2e) sets trust proxy,
security headers, CSRF protection, CORS, cookie parser, global prefix and `ValidationPipe`, in
that order; `main.ts` adds Swagger and shutdown hooks and listens. Global guards, interceptors
and the filter are registered in `AppModule` with `APP_GUARD`/`APP_INTERCEPTOR`/`APP_FILTER` so
they can inject dependencies. See `templates/src/app.setup.ts`, `main.ts` and `app.module.ts`.

## Ordering of global enhancers

Nest runs, per request: **middleware → guards → interceptors (before) → pipes → handler →
interceptors (after) → exception filters**. Within one kind, global providers run in
registration order. That's why `app.module.ts` registers:

1. `JwtAuthGuard` before `PermissionsGuard` (permissions need `req.user`).
2. `ResponseInterceptor` before `AuditInterceptor`, so the response interceptor is outermost and
   wraps the final value after the audit interceptor has seen the raw result.
