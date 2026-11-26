# Packages — use the latest

This skill targets the **current major of every package**. The templates type-check and their
unit tests pass against exactly these versions:

| Package | Version | Notes |
|---|---|---|
| `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing` | 12.6 | ESM-only packages; CommonJS apps load them via `require(esm)` |
| `@nestjs/config` | 12.1 | `validationSchema` takes any Standard Schema; Joi needs ≥ 18 |
| `@nestjs/swagger` | 12.1 | mapped types imported from here |
| `@nestjs/typeorm` | 12.0 | |
| `@nestjs/passport` | 12.0 | |
| `@nestjs/jwt` | 12.0 | |
| `@nestjs/terminus` | 12.2 | legacy `HealthIndicator` API removed |
| `@nestjs/throttler` | 6.8 | versioned separately from the core packages |
| `typeorm` | 1.1 | |
| `pg` | 8.23 | |
| `class-validator` | 0.15 | |
| `class-transformer` | 0.5 | |
| `joi` | 18.3 | required ≥ 18 with `@nestjs/config` 12 |
| `passport` / `passport-jwt` | 0.7 / 4.0 | |
| `cookie-parser` | 1.4 | |
| `rxjs` | 7.8 | |
| `reflect-metadata` | 0.2 | |
| `typescript` | 7.0 | |
| `@types/express` | 5.0 | Express 5 types route params as `string \| string[]` |
| `supertest` | 7.3 | |

## Rules

- **Install without a version** so the package manager resolves the latest
  (`bun add @nestjs/common @nestjs/core …`), then commit the lockfile. Don't copy version ranges
  from an older project.
- **Keep the `@nestjs/*` packages on the same major.** Mixing 11 and 12 fails at runtime with
  duplicate-module and metadata errors.
- Upgrade with `nest upgrade` (or bump all `@nestjs/*` together), read the migration guide at
  docs.nestjs.com/migration-guide, then run the full test suite.
- When this table drifts from what's on npm, the latest release wins. Update this file in the
  same change as the upgrade.

**No `helmet`, no `csrf-csrf`.** NestJS 12.1+ has security headers
(`app.useSecurityHeaders()`, helmet 8's defaults) and CSRF protection
(`app.enableCsrfProtection()`) built in. Add those packages only on Fastify or an older core.

## Runtime

| What | Minimum |
|---|---|
| Running a NestJS 12 app | Node.js **20.19+**, or **22.12+** on the 22 line |
| `nest new` / `nest generate` | Node.js **22.22.3+**, **24.15+**, or **26+** |
| Jest loading the ESM-only v12 packages | Node.js **24.9+** (otherwise use Vitest) |

## Install line

```bash
bun add @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/config @nestjs/swagger \
  @nestjs/typeorm @nestjs/passport @nestjs/jwt @nestjs/throttler @nestjs/terminus \
  typeorm pg passport passport-jwt class-validator class-transformer joi cookie-parser \
  rxjs reflect-metadata dotenv

bun add -d @nestjs/cli @nestjs/schematics @nestjs/testing typescript supertest \
  @types/express @types/cookie-parser @types/passport-jwt @types/supertest @types/node
```

Swap `bun add` for `pnpm add` / `npm i` per decision gate 11, and add the test runner from
decision gate 10 (`jest ts-jest @types/jest` or `vitest`).
