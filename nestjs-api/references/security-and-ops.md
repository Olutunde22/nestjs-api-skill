# Security & operations

All of the bootstrap pieces below live in `templates/src/app.setup.ts`, which `main.ts` calls
straight after `NestFactory.create()` and the e2e tests call the same way.

## Order matters

On Express, the security hook is registered where the first of `useSecurityHeaders()` /
`enableCsrfProtection()` is called. Middleware added with `app.use()` before that runs
unprotected, and responses it ends itself carry no security headers. So, in this order:

1. `app.set('trust proxy', …)`
2. `app.useSecurityHeaders(…)`
3. `app.enableCsrfProtection(…)`
4. `app.enableCors(…)`
5. `app.use(cookieParser())` and any other middleware
6. global prefix, `ValidationPipe`

## Security headers

NestJS 12.1+ has them built in — no `helmet` package:

```ts
app.useSecurityHeaders({
  contentSecurityPolicy: true,
  strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
  referrerPolicy: { policy: 'no-referrer' },
  xFrameOptions: { action: 'deny' },
});
```

- Same headers and defaults as helmet 8: a default `Content-Security-Policy`,
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-Frame-Options`, and
  `X-Powered-By` removed. Applied to every response, including 404s and errors.
- Option names match helmet's, so an existing helmet config carries over (except helmet's
  legacy aliases like `hsts`/`frameguard`). `false` leaves a header out; a route can still
  override one with `@Header()`.
- An API serves JSON, so the strict default CSP is right. If the same app serves Swagger UI and
  it doesn't load, relax the directive it needs rather than turning CSP off.
- On Fastify, or before 12.1: `helmet` / `@fastify/helmet`, registered before any other
  `app.use()`.

## CORS

```ts
app.enableCors({
  origin: corsOrigins,            // exact origins from config
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Retry-After'],
  maxAge: 600,
});
```

- **An explicit allowlist, always.** Never `origin: true` or `'*'` with `credentials: true`:
  `origin: true` echoes any origin back, so any website can make authenticated requests and
  read the responses.
- Origins are **exact serialized origins** — `scheme://host[:port]`, no path, no trailing slash,
  no wildcard. `https://app.example.com/` matches nothing. The template's config validation
  rejects anything else at boot.
- List `methods` explicitly. On Fastify, a cross-origin `PUT`/`PATCH`/`DELETE` fails preflight
  unless the method is listed.
- Expose only headers clients need (`Retry-After` for 429s).
- CORS controls which sites can **read** responses. It does not stop a cross-site form post from
  **sending** one — that's what CSRF protection is for.

## CSRF

Needed whenever a browser authenticates with a **cookie**: the browser attaches it to requests
other sites trigger. Bearer-only APIs (mobile, server-to-server) aren't exposed, but the
template accepts both, so it's on.

NestJS 12.1+ has it built in, with no token and no client change:

```ts
app.enableCsrfProtection({
  trustedOrigins: corsOrigins,
  exclude: [{ path: 'webhooks/payments', method: RequestMethod.POST }],
});
```

- Based on Fetch Metadata (`Sec-Fetch-Site`) with an `Origin`/`Host` fallback (the algorithm of
  Go's `net/http.CrossOriginProtection`). `GET`/`HEAD`/`OPTIONS` always pass; a cross-origin
  state-changing request from a browser is rejected with a 403 through the exception filter.
- Requests with neither `Sec-Fetch-Site` nor `Origin` (mobile apps, CLIs, other servers) pass.
- **Origins allowed by CORS are not trusted implicitly** — pass the same allowlist as
  `trustedOrigins`, or your own frontend gets 403s.
- `exclude` inbound webhooks from third-party servers; they authenticate by signature instead.
- Behind a proxy that rewrites `Host`, preserve it or list the public origin in
  `trustedOrigins` — `X-Forwarded-Host` is ignored.
- Keep `sameSite: 'lax'` (or `'strict'`) on auth cookies as a second layer.
- If you must protect very old browsers that send neither header, add a token scheme
  (`csrf-csrf` double-submit cookie on Express, `@fastify/csrf-protection` on Fastify). That
  needs client changes: the client reads a token and sends it on every write.
- Safe methods must stay safe: a `GET` that changes state is exempt from every CSRF defence.

## Rate limiting

Two named throttlers, both from config (`RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX`,
`RATE_LIMIT_STRICT_MAX`):

- `default` applies to every route.
- `strict` applies only to routes marked `@StrictThrottle()` — sign-in, password reset, OTP
  verification, invite acceptance, and anything that sends email or SMS. Both limits apply on
  those routes.

```ts
@Public()
@StrictThrottle()
@Post('sign-in')
signIn(@Body() dto: SignInDto) {}
```

- **A module-level `skipIf` beats any per-route `@Throttle()` override**, so the strict throttler
  is switched on by `@StrictThrottle()`'s metadata through `skipIf: (ctx) => !isStrictRoute(ctx)`.
  Setting `skipIf: () => true` and overriding per route silently never limits anything.
- `ThrottlerGuard` is the **first** global guard, so floods are rejected before auth or the
  database are touched.
- `@SkipThrottle()` for health checks and trusted internal callers.
- **Set `trust proxy` behind a load balancer** (`TRUST_PROXY=loopback`, a hop count, or the LB's
  CIDR). Without it every client shares the proxy's IP and one limit. Never `true` on a host
  reachable without the proxy — clients could then forge `X-Forwarded-For`.
- The default storage is in-memory, per instance. With several replicas use a shared store
  (Redis), or the effective limit is `limit × replicas`.
- For sign-in, also limit per **account** (failed attempts per username), not only per IP, so a
  botnet can't spray one account.
- The 429 goes through the exception filter in the normal error envelope; document it with
  `ApiErrorResponses(…, 429)` or `@StrictThrottle()` (which documents it).

## Request size

Set a body size limit suited to the API (`app.useBodyParser('json', { limit: '1mb' })`) and
stream uploads instead of buffering them. Unbounded bodies are a cheap denial of service.

## Credential stripping

`StripCredentialsInterceptor` removes credential-shaped fields from **every** response, at any
depth, before the envelope is applied: passwords and hashes, salts, OTPs and OTP/TOTP/MFA
secrets, recovery codes, PINs, CVV/CVC, card numbers, secrets, API keys, private keys, and
access/refresh/ID/session/reset/invite tokens.

- It's the **last line of defence**, not the first. Services still keep credentials out of
  responses: `select: false` on hash columns, explicit response mapping, never spreading an
  entity into a response.
- Keys are matched after lower-casing and removing `_`/`-`, plus suffixes (`…Password`,
  `…Secret`, `…Token`, `…ApiKey`, `…PrivateKey`, `…Otp`), so `password_hash`, `webhookSecret`
  and `resetToken` are all caught while `passwordUpdatedAt`, `tokenCount` and `pinned` are not.
- A route that must return a credential names it: `@ExposeCredentials('accessToken')`. There is
  no way to expose everything.
- Credentials never go in logs, audit summaries or error messages either. Log ids.
- Extend the list in `common/security/strip-credentials.ts` when the domain has its own secrets,
  and add the key to its spec.

## Health checks

Exclude health from the global prefix and from the response envelope so probes see the native
shape. With `@nestjs/terminus`:

```ts
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthCheckService, private readonly db: TypeOrmHealthIndicator) {}

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([() => this.db.pingCheck('database').withTimeout('1s')]);
  }
}
```

- **Liveness** checks only the process; **readiness** checks dependencies. A database outage
  should fail readiness (stop sending traffic), not liveness (restart loop).
- NestJS 12 removed the legacy `HealthIndicator`/`HealthCheckError` API; custom indicators use
  `HealthIndicatorService.check(key).up()/.down()` or `.attempt(fn).withTimeout(ms)`.
- `HttpHealthIndicator` is deprecated in favour of `FetchHealthIndicator`.

## Graceful shutdown

`app.enableShutdownHooks()` runs `onModuleDestroy`/`beforeApplicationShutdown` on SIGTERM, closes
database pools, and (NestJS 12, Express) drains in-flight requests. Pair with
`TerminusModule.forRoot({ gracefulShutdownTimeoutMs })` so readiness reports shutting down before
connections close.

## Logging

- Use Nest's `Logger` with a context (`new Logger(ThingsService.name)`), never `console.log`.
- NestJS 12's `ConsoleLogger` attaches a plain object after the message as structured params:
  `this.logger.log('Thing created', { thingId })`. Prefer that to string interpolation.
- Never log secrets, tokens, passwords, full card numbers, or request bodies that can contain
  them. Log ids, not personal data.
- Log the reason a request was rejected at `warn` when it's diagnosable (signature mismatch vs.
  stale timestamp) but return a generic message to the caller.

## Secrets & crypto

- Hash passwords with bcrypt/argon2, never a fast hash. Compare tokens and signatures with
  `crypto.timingSafeEqual`.
- Separate secrets per purpose and per direction (access vs refresh tokens, inbound vs outbound
  signing) so one leak doesn't grant everything.
- Single-use tokens (invites, password reset) are stored hashed, expire, and are consumed
  atomically.

## Deploy

- Multi-stage Dockerfile: build stage with dev dependencies, runtime stage with production
  dependencies only, running as a non-root user.
- Migrations run once per deploy (a release step or `migrationsRun` on a single instance),
  before traffic shifts.
- Node.js minimum for NestJS 12: **20.19+** (or **22.12+** on the 22 line).
