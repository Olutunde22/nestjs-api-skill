# Configuration

## Shape

Two files:

- `config/configuration.ts` — a **typed object** built from `process.env`, with defaults for
  local development. The only file that reads `process.env`.
- `config/validation.ts` — the **env schema** validated at boot. A bad or missing value stops the
  process with a clear message.

```ts
ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  load: [configuration],
  validationSchema,
});
```

Read config through the typed service:

```ts
constructor(private readonly config: ConfigService<AppConfig, true>) {}
const { accessSecret } = this.config.get('jwt', { infer: true });
```

`ConfigService<AppConfig, true>` + `{ infer: true }` makes `get` return the property's real type
and rejects unknown keys at compile time.

Alternatively, split config into namespaces with `registerAs('database', () => ({…}))` and inject
`ConfigType<typeof databaseConfig>`. Either is fine; don't mix both styles in one project.

## Validation (decision gate 9)

- **Joi** (default). On NestJS 12, Joi must be **v18 or later**, and Joi-specific options move
  under `validationOptions.libraryOptions`.
- **Zod / any Standard Schema** (NestJS 12): `validationSchema: z.object({ PORT: z.coerce.number().default(3000) })`.
- **class-validator** via a `validate(config)` function using `plainToInstance` + `validateSync`.

## Rules

- **Secrets are required outside development.** A secret that disables a check when empty
  (request signing, webhook verification) must be required in staging and production:

  ```ts
  const serviceSecret = Joi.string().when('APP_ENV', {
    is: Joi.valid('staging', 'production'),
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').default(''),
  });
  ```

- **Separate `NODE_ENV` from `APP_ENV`.** `NODE_ENV` is how the code was built (`production` on
  staging too); `APP_ENV` is where it runs (`staging`). Branch on `APP_ENV`.
- **Refuse dangerous combinations at boot.** If a staging instance must never call the production
  site or payment account, check the configured host belongs to `APP_ENV` in `onModuleInit` and
  throw.
- **Unsafe features default off everywhere,** production included. "Send real emails",
  "charge real cards" are opted into with an explicit `true`, never inherited from a missing
  variable.
- Booleans from env: `Joi.boolean().truthy('true').falsy('false')`, or compare to `'true'`.
  `Boolean('false')` is `true`.
- Lists from env: split on commas, trim, drop empties (CORS origins).
- Commit a `.env.example` with every variable and a safe placeholder; never commit `.env`.
- Keep per-environment values out of code: no `if (APP_ENV === 'production') url = '…'`.

## Using config in other modules

Async module registration reads from the typed service:

```ts
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>) => ({
    secret: config.get('jwt', { infer: true }).accessSecret,
    signOptions: { expiresIn: config.get('jwt', { infer: true }).accessTtl },
  }),
}),
```
