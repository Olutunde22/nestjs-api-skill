import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { StripCredentialsInterceptor } from './common/interceptors/strip-credentials.interceptor';
import { isStrictRoute, THROTTLERS } from './common/throttle';
import configuration, { AppConfig } from './config/configuration';
import { validationSchema } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThingsModule } from './modules/things/things.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [configuration], validationSchema }),
    // Rate limiting. 'default' applies everywhere; 'strict' only on routes marked
    // @StrictThrottle(). In-memory storage is per instance: with several replicas
    // pass a shared store (Redis) or the real limit is limit × replicas.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const { ttlMs, limit, strictLimit } = config.get('security', { infer: true }).rateLimit;
        return {
          throttlers: [
            { name: THROTTLERS.default, ttl: ttlMs, limit },
            {
              name: THROTTLERS.strict,
              ttl: ttlMs,
              limit: strictLimit,
              skipIf: (context) => !isStrictRoute(context),
            },
          ],
        };
      },
    }),
    DatabaseModule,
    AuditModule,
    AuthModule,
    HealthModule,
    ThingsModule,
  ],
  providers: [
    // Guards run in registration order: rate limit, authenticate (sets req.user), authorize.
    // useExisting (not useClass) so e2e tests can override them with overrideProvider().
    ThrottlerGuard,
    JwtAuthGuard,
    PermissionsGuard,
    { provide: APP_GUARD, useExisting: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
    // First registered is outermost. On the way out: the handler result passes AuditInterceptor,
    // then credentials are stripped, then ResponseInterceptor wraps the clean value.
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: StripCredentialsInterceptor },
    { provide: APP_INTERCEPTOR, useExisting: AuditInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
