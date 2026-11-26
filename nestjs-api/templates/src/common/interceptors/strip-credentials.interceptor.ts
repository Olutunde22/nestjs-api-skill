import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { EXPOSE_CREDENTIALS_KEY } from '../decorators/expose-credentials.decorator';
import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator';
import { stripCredentials } from '../security/strip-credentials';

// LOAD-BEARING: the last line of defence. Services should never return a password hash, OTP
// or secret in the first place (select: false, response mapping), but one forgotten
// relation or spread entity is enough to leak one. This strips them from every response.
@Injectable()
export class StripCredentialsInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, targets)) {
      return next.handle();
    }
    const allow = this.reflector.getAllAndOverride<string[] | undefined>(EXPOSE_CREDENTIALS_KEY, targets) ?? [];
    return next.handle().pipe(map((value) => stripCredentials(value, allow)));
  }
}
