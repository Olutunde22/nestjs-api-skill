# Responses & errors

Every response has one of two shapes. Clients branch on `success` and never guess.

```jsonc
// success
{ "success": true, "data": { … } }

// success, paginated
{ "success": true, "data": [ … ], "pagination": { "total": 42, "page": 1, "pageSize": 20 } }

// error
{
  "success": false,
  "statusCode": 409,
  "message": "A thing with this name already exists",   // string, or string[] for validation
  "error": "Conflict",                                   // optional
  "errorCode": "THING_NAME_TAKEN",                       // optional, machine-readable
  "path": "/api/things",
  "timestamp": "2026-01-31T10:00:00.000Z"
}
```

If the project chose a different envelope at decision gate 2, change it in exactly three
places: `ResponseInterceptor`, `AllExceptionsFilter`, and `common/docs/api-responses.ts`.

## Success: `ResponseInterceptor`

- Wraps whatever the handler returns as `{ success: true, data }`. `undefined` becomes `null`.
- **Lifts pagination:** a service result shaped `{ items, total, page, pageSize }` becomes
  `{ success: true, data: items, pagination: { total, page, pageSize } }`. Services return the
  plain `Paginated<T>`; they never build the envelope.
- **Skips** health endpoints (probes expect their native shape) and streamed/file responses.
- Handlers that return `204` (`@HttpCode(204)` with no return) send no body.

## Credentials: `StripCredentialsInterceptor`

Runs inside `ResponseInterceptor`, so the value is cleaned before it's wrapped. Every response
loses password/OTP/PIN/secret/token/key fields at any depth unless the route names the field
with `@ExposeCredentials(...)`. See `security-and-ops.md`.

## Errors: `AllExceptionsFilter`

- Registered with `APP_FILTER` (so it can inject a logger or config), and it's `@Catch()` —
  everything.
- `HttpException`: status and message come from the exception; validation arrays are preserved.
- **Anything else is a 500 with a generic message.** The real error and stack go to the log,
  never to the client. This includes database errors (which leak table and constraint names) and
  messages from third-party providers.
- Logs 4xx at `warn` and 5xx at `error`, with method and URL.

## Throwing

Services throw Nest's built-in exceptions; the filter shapes them.

| Situation | Exception |
|---|---|
| Resource doesn't exist (or caller can't see it) | `NotFoundException` |
| Input is well-formed but violates a rule | `BadRequestException` |
| Duplicate / state conflict (already cancelled, name taken) | `ConflictException` |
| Not signed in / bad token | `UnauthorizedException` (usually from the guard) |
| Signed in, not allowed | `ForbiddenException` (usually from the guard) |
| Upstream service failed | `BadGatewayException` / `ServiceUnavailableException` |

- Messages are **for the caller**: say what is wrong and, where possible, how to fix it.
  `'Event is cancelled and can no longer be edited'`, not `'Invalid state'`.
- Add `errorCode` when a client must branch on the reason (NestJS 12:
  `new ConflictException('Name taken', { errorCode: 'THING_NAME_TAKEN' })`).
- Pass the underlying error as `cause` for the log, never in the message.
- **Translate unique-constraint violations** into a 409 in the service (catch the driver error
  code, e.g. Postgres `23505`), so a race that slips past a pre-check still gets a clean message.
- **Don't reveal existence across a permission boundary.** If a caller may not see a resource,
  a 404 is often better than a 403.

## Errors from another service

The outbound client converts a remote failure into an `HttpException`:

- 4xx from the remote: propagate the status and the remote's user-facing message.
- 5xx, timeout, network error: `BadGatewayException` with a generic message; log the detail.
- Never forward a raw provider payload, stack, or internal URL to the client.

## Documenting it

The shared builders in `common/docs/api-responses.ts` produce examples in exactly these shapes.
When the interceptor or filter changes, update the builders in the same change; every
`*.doc.ts` follows automatically.
