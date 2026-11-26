import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PERMISSIONS } from '../src/common/permissions';

// Needs a disposable Postgres in DATABASE_URL (a container in CI). Migrations run at boot.
describe('Things (e2e)', () => {
  let app: NestExpressApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    // A real token through the real strategy: auth is part of the contract, so don't disable it.
    token = app.get(JwtService).sign({
      sub: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      username: 'e2e',
      permissions: [PERMISSIONS.THINGS_READ, PERMISSIONS.THINGS_WRITE],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request in the error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/api/things').expect(401);
    expect(res.body).toMatchObject({ success: false, statusCode: 401 });
  });

  it('strips unknown fields and creates a thing in the success envelope', async () => {
    const name = `e2e ${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/things')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, createdById: 'someone-else' })
      .expect(201);
    expect(res.body).toMatchObject({ success: true, data: { name, status: 'draft' } });
    expect(res.body.data.createdById).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7');
  });

  it('answers a duplicate name with 409', async () => {
    const name = `dup ${Date.now()}`;
    const server = app.getHttpServer();
    await request(server).post('/api/things').set('Authorization', `Bearer ${token}`).send({ name }).expect(201);
    const res = await request(server)
      .post('/api/things')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(409);
    expect(res.body).toMatchObject({ success: false, message: 'A thing with this name already exists' });
  });

  it('rejects a cross-site browser write (CSRF) before it reaches the handler', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/things')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'https://evil.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ name: `csrf ${Date.now()}` })
      .expect(403);
    expect(res.body).toMatchObject({ success: false, statusCode: 403 });
  });

  it('sends security headers and no X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('answers CORS preflight only for allowlisted origins', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/api/things')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3001');

    const denied = await request(app.getHttpServer())
      .options('/api/things')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('lifts pagination out of the list result', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/things?pageSize=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({ success: true, pagination: { page: 1, pageSize: 5 } });
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
