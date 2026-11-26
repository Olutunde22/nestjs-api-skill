import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { SKIP_ENVELOPE_KEY } from '../decorators/skip-envelope.decorator';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  pagination?: { total: number; page: number; pageSize: number };
}

const isPaginated = (
  value: unknown,
): value is { items: unknown[]; total: number; page: number; pageSize: number } =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as { items?: unknown }).items) &&
  typeof (value as { total?: unknown }).total === 'number';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((value): SuccessEnvelope<unknown> => {
        if (isPaginated(value)) {
          const { items, total, page, pageSize } = value;
          return { success: true, data: items, pagination: { total, page, pageSize } };
        }
        return { success: true, data: value ?? null };
      }),
    );
  }
}
