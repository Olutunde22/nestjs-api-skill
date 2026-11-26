import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppConfig } from './config/configuration';

// Shared by main.ts and the e2e tests, so tests exercise the same app that ships.
// Call it straight after NestFactory.create(): the security hook is registered where the
// first of useSecurityHeaders()/enableCsrfProtection() is called, and middleware added with
// app.use() before it would run unprotected.
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<AppConfig, true>);
  const security = config.get('security', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });

  // Behind a proxy or load balancer, req.ip is the proxy unless this is set. Rate limits and
  // audit logs would then be per proxy instead of per client.
  if (security.trustProxy !== false) {
    app.set('trust proxy', security.trustProxy);
  }

  // Security headers: helmet 8's set and defaults, built into NestJS 12.1+. Also removes
  // X-Powered-By. Set on every response, including 404s and errors.
  app.useSecurityHeaders({
    contentSecurityPolicy: true,
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
    xFrameOptions: { action: 'deny' },
  });

  // LOAD-BEARING with cookie auth: the browser attaches the session cookie to cross-site
  // requests, so a malicious page could act as the user. Rejects cross-origin POST/PUT/PATCH/
  // DELETE from browsers (Sec-Fetch-Site, Origin fallback). Bearer-only clients (mobile, CLI,
  // other servers) send neither header and are unaffected. Origins allowed by CORS are not
  // trusted implicitly, so the same allowlist is passed here.
  app.enableCsrfProtection({
    trustedOrigins: corsOrigins,
    // OPTIONAL: inbound webhooks from third-party servers, e.g.
    // exclude: [{ path: 'webhooks/payments', method: RequestMethod.POST }],
  });

  // LOAD-BEARING: an explicit allowlist. Never origin: true (or '*') with credentials: true,
  // which lets any website make authenticated requests and read the responses.
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Retry-After'],
    maxAge: 600,
  });

  app.use(cookieParser());
  app.setGlobalPrefix('api', { exclude: ['health/live', 'health/ready'] });

  // LOAD-BEARING: whitelist strips any property without a validator, so a client cannot set
  // fields the DTO does not declare.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
}
