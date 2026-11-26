# Testing

## What to test where

| Kind | Tests | Runs against |
|---|---|---|
| Unit | services, guards, interceptors, pure helpers | fakes, no Nest container needed |
| Integration | queries, migrations, transactions | a disposable real database |
| E2E | the HTTP contract of critical paths | the app with the real global setup |

Write the test from the behaviour first ("a duplicate name returns 409"), then the code.

## Unit: construct the class directly

Most services need no testing module. Pass fakes to the constructor:

```ts
const repo = { findOne: jest.fn(), save: jest.fn((t) => Promise.resolve(t)) };
const service = new ThingsService(repo as unknown as Repository<Thing>);

it('rejects a duplicate name', async () => {
  repo.findOne.mockResolvedValue({ id: 'x', name: 'Taken' });
  await expect(service.create({ name: 'Taken' } as CreateThingDto, user)).rejects.toBeInstanceOf(ConflictException);
});
```

Use `Test.createTestingModule` when DI wiring itself is under test, with `getRepositoryToken`:

```ts
const moduleRef = await Test.createTestingModule({
  providers: [ThingsService, { provide: getRepositoryToken(Thing), useValue: repo }],
}).compile();
const service = moduleRef.get(ThingsService);
```

`useMocker(token => …)` auto-mocks every missing dependency; `resolve()` instead of `get()` for
request-scoped providers.

### Guards

Build a minimal `ExecutionContext` and a `Reflector` stubbed for the metadata you need. Test both
the allow and the deny path, and that a denial is recorded when auditing is on.

### Outbound clients

Pin the exact wire body the HTTP client sends (method, path, headers, casing). A silently dropped
or misnamed field is the failure mode that no other test catches.

## E2E: same global setup as `main.ts`

Factor `main.ts`'s app configuration into a function both use, or repeat it exactly. An e2e test
that skips the `ValidationPipe` or the prefix tests a different app.

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(PAYMENTS_CLIENT).useValue(fakePayments)
  .compile();
app = moduleRef.createNestApplication();
configureApp(app); // prefix, ValidationPipe, cookie parser — same as main.ts
await app.init();

await request(app.getHttpServer())
  .post('/api/things')
  .set('Cookie', authCookie)
  .send({ name: 'Rooftop' })
  .expect(201)
  .expect(({ body }) => expect(body).toMatchObject({ success: true, data: { name: 'Rooftop' } }));
```

- **Overriding a global guard** requires it to be registered with `useExisting`:
  `{ provide: APP_GUARD, useExisting: JwtAuthGuard }, JwtAuthGuard` then
  `.overrideProvider(JwtAuthGuard).useClass(FakeAuthGuard)`. With `useClass` it can't be replaced.
- Prefer signing in through the real login route (or minting a real token with the test secret)
  over disabling auth: auth is part of the contract.
- Assert on the **envelope**, not just the status: e2e tests are what catch a doc example that
  drifted from the real shape.
- Close the app in `afterAll`.

## Runner (decision gate 10)

- CommonJS projects default to **Jest** (`ts-jest`). On NestJS 12 (ESM-only packages), Jest can
  load them only on Node.js **24.9+**; older Node fails with `ERR_REQUIRE_ASYNC_MODULE`.
- ESM projects default to **Vitest**. Same APIs for the patterns above (`vi.fn()` for `jest.fn()`).
- The Swagger CLI plugin doesn't run under `ts-jest`; tests that assert on the generated document
  need the plugin's AST transformer configured.
