# Authentication, authorization & audit

## Authenticate globally, opt out explicitly

Register the auth guard as a global `APP_GUARD`. Every route requires a valid identity unless it
carries `@Public()`.

```ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```ts
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(),
  context.getClass(),
]);
if (isPublic) return true;
```

- `getAllAndOverride` checks the handler first, then the class, so `@Public()` works on either.
- `@Public()` turns off the **user** guard; it doesn't mean "unauthenticated". A route protected
  by a service-to-service signature guard is `@Public()` plus its own `@UseGuards(SignatureGuard)`.
- Login, refresh, password-reset, health and inbound webhooks are the usual `@Public()` routes.
  Each one should be obvious in review.

## Token transport

Default (decision gate 4): Passport `jwt` strategy reading the access token from an **httpOnly
cookie first, then the `Authorization: Bearer` header**:

```ts
jwtFromRequest: ExtractJwt.fromExtractors([
  (req: Request) => req?.cookies?.[accessCookieName] ?? null,
  ExtractJwt.fromAuthHeaderAsBearerToken(),
]),
```

- The cookie serves browsers; bearer serves server-to-server callers (an SSR frontend forwarding
  the user's token) and mobile.
- Cookie options live in one function: `httpOnly: true`, `secure` from config, `sameSite: 'lax'`,
  `path: '/'`, explicit `maxAge` per token. Logout clears both cookies with the same `path` and
  `domain` they were set with — a mismatch leaves the cookie alive.
- **Cookie auth needs CSRF protection.** The template enables NestJS's built-in
  `app.enableCsrfProtection()` with the CORS allowlist as `trustedOrigins`; see
  `security-and-ops.md`. Bearer-only clients are unaffected.
- **Rate-limit every credential endpoint** (sign-in, refresh, reset, OTP) with `@StrictThrottle()`,
  and also count failed attempts per account.
- **Never return a credential in a body by accident.** `StripCredentialsInterceptor` removes
  tokens from responses; a sign-in that must return one names it with
  `@ExposeCredentials('accessToken')`.
- **Namespace cookie names per environment** (`dv_ac_tk`, `st_ac_tk`, `pr_ac_tk`) when
  environments share a parent domain, so a staging login can't overwrite a production session.
- `validate()` **reloads the user** each request (or checks a token version) so deactivation and
  role changes apply immediately rather than when the token expires.

### Refresh

Two workable designs; pick one:

1. **Client refreshes**: a 401 makes the client call `POST /auth/refresh` and retry.
2. **Guard refreshes**: when the access token fails and a valid refresh cookie is present, the
   guard mints a new pair, sets the cookies, sets `req.user`, and lets the request through. Log
   when a request has no refresh cookie to fall back on, so a bearer-only caller's 401s are
   explainable.

Refresh tokens are long-lived: sign them with a **different secret** from access tokens, rotate
them on use, and revoke them on logout and password change.

### NestJS 12: `@nestjs/authentication`

v12 ships `@nestjs/authentication` (sessions, access tokens, a credential-provider registry, its
own global `AuthenticationGuard` and `@Public()`). It's a reasonable choice for a new v12 project
(decision gate 4). Don't run it alongside a Passport global guard — pick one.

## Authorize with permissions, not roles

```ts
export const PERMISSIONS = {
  THINGS_READ: 'things:read',
  THINGS_WRITE: 'things:write',
} as const;
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
```

- A **registry** of permission keys (`resource:action`) is the single source of truth. Roles are
  data: a role is a named set of permissions, editable without a deploy.
- `@RequirePermissions(PERMISSIONS.THINGS_WRITE)` on the route; `PermissionsGuard` (registered
  after the auth guard) checks the user holds **all** listed keys.
- A seed/migration inserts every key in the registry and grants them all to a super-admin role.
  A new key in code without a seed row is a permission nobody can be granted.
- Branching on a role name inline (`if (user.roles.includes('admin'))`) is the anti-pattern. If a
  service needs a finer rule ("may see PII"), check a permission key.

## Field-level access (PII)

When some fields are sensitive (email, phone, legal name), exclude them from default projections
and return them only when the caller has a dedicated permission (`users:read_pii`) **and** asked
for them (`?pii=true`). Searching or sorting by a sensitive column is gated the same way:
the result order leaks the values.

## Audit

Decision gate 6. When on:

- `@Audit({ action: 'thing.update', resourceType: 'thing', resourceIdParam: 'id' })` on every
  mutation. A global `AuditInterceptor` records actor, action, resource, outcome
  (`success`/`error`), IP and user agent after the handler settles.
- `PermissionsGuard` records **denials** itself — the interceptor never runs for a request the
  guard rejected.
- Sensitive reads (revealing PII, viewing financial records) are audited explicitly in the service
  or controller.
- Audit rows are **append-only**: no update or delete endpoint, ever.
- Record the **end user's** IP. Behind a reverse proxy or an SSR frontend, the socket IP is the
  proxy's; trust a forwarded header only from your own proxy (`app.set('trust proxy', …)` or a
  header your frontend sets and the edge strips from inbound traffic).
- Writing the audit row is fire-and-forget for successes (`void this.audit.record(...)`), so an
  audit outage doesn't fail the user's request — but log the failure.

## Service-to-service calls

Inbound calls from another backend use a **signature guard** instead of the user guard: HMAC over
method + path + timestamp + body with a shared secret, a replay window, constant-time comparison,
and a separate secret per direction. Refuse to boot outside development without the secret
(see `config.md`); an empty secret that disables verification must never reach production.
