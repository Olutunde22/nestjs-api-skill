import { applyDecorators, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiResponse } from '@nestjs/swagger';
import { errorExample } from './docs/api-responses';

export const THROTTLERS = { default: 'default', strict: 'strict' } as const;

const STRICT_THROTTLE_KEY = 'strictThrottle';
const reflector = new Reflector();

// LOAD-BEARING: the strict throttler's skipIf. A module-level skipIf wins over any per-route
// @Throttle() override, so the strict limit is switched on by this marker instead.
export const isStrictRoute = (context: ExecutionContext): boolean =>
  reflector.getAllAndOverride<boolean>(STRICT_THROTTLE_KEY, [
    context.getHandler(),
    context.getClass(),
  ]) === true;

// For sign-in, password reset, invite acceptance, and anything that sends email or SMS.
// The default limit still applies; the strict one is added on top.
export const StrictThrottle = () =>
  applyDecorators(
    SetMetadata(STRICT_THROTTLE_KEY, true),
    ApiResponse({
      status: 429,
      description: 'Too many attempts. Wait before retrying (see Retry-After).',
      schema: { example: errorExample(429, 'ThrottlerException: Too Many Requests') },
    }),
  );
