# nestjs-api — an agent skill for NestJS REST APIs

A skill for Claude Code and other agents that read `SKILL.md` skills. It teaches a production
NestJS architecture and gives the agent real files to copy, so a new API or a new feature
module comes out the same way every time.

Built on the latest NestJS (12) and its current packages. The templates type-check and their
tests pass against the versions listed in
[`nestjs-api/references/packages.md`](nestjs-api/references/packages.md).

## What it encodes

- **Thin controllers.** A controller method is route decorators, one doc decorator and one
  service call. Business rules live in services, which throw Nest HTTP exceptions.
- **Swagger kept out of controllers.** Each module has a `<feature>.doc.ts` that exports one
  decorator per endpoint, composed with `applyDecorators`. Shared builders wrap every example
  in the real response envelope, so docs can't drift from what the API returns.
- **One response envelope.** `{ success: true, data, pagination? }` from a global interceptor,
  `{ success: false, statusCode, message, … }` from a global exception filter that never leaks
  internals.
- **Secure by default.** NestJS's built-in security headers and CSRF protection, an exact CORS
  allowlist checked at boot, rate limiting with a strict preset for credential endpoints, and an
  interceptor that strips passwords, OTPs, PINs, secrets, keys and tokens from every response.
- **Authentication on by default.** A global guard with an explicit `@Public()` opt-out, JWT
  read from an httpOnly cookie or a bearer header.
- **Permissions, not roles.** A permission registry, `@RequirePermissions`, denials recorded.
- **Append-only audit trail.** `@Audit` on mutations, written by an interceptor.
- **Validated input and config.** A whitelisting `ValidationPipe` with a DTO for every body and
  query; env validated at boot, with secrets required outside development.
- **TypeORM with migrations,** never `synchronize`, plus rules for read-only data sources.
- **Testing.** Services unit-tested with plain constructors; e2e tests run the same global setup
  as `main.ts`.

## Layout

```
nestjs-api/
  SKILL.md        decision gate, core rules, build order, anti-patterns
  references/     one file per layer: swagger-docs, modules-and-di, validation,
                  responses-and-errors, auth, data, config, testing, security-and-ops, packages
  templates/      a complete things module and every cross-cutting file it needs
```

## Install

Copy the skill folder into your skills directory.

For one project:

```bash
mkdir -p .claude/skills && cp -R nestjs-api .claude/skills/
```

For every project on your machine:

```bash
mkdir -p ~/.claude/skills && cp -R nestjs-api ~/.claude/skills/
```

The agent picks it up when you start or change a NestJS API. You can also ask for it by name:
"use the nestjs-api skill to add an invoices module".

## Credits

The `*.doc.ts` approach to Swagger comes from
[beam-backend](https://github.com/Olutunde22/beam-backend/blob/main/src/modules/user/user.doc.ts).
Framework guidance follows the official [NestJS documentation](https://docs.nestjs.com).

## License

MIT
