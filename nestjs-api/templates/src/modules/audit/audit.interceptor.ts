import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, AuditMeta } from '../../common/decorators/audit.decorator';
import { AuthenticatedUser } from '../../common/types';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const param = meta.resourceIdParam ? request.params?.[meta.resourceIdParam] : undefined;
    const base = {
      actorId: request.user?.id,
      action: meta.action,
      resourceType: meta.resourceType,
      resourceId: Array.isArray(param) ? param[0] : param,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    return next.handle().pipe(
      tap({
        next: () => void this.audit.record({ ...base, outcome: 'success' }),
        error: (err: Error) =>
          void this.audit.record({ ...base, outcome: 'error', summary: err?.message }),
      }),
    );
  }
}
