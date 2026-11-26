import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PermissionKey } from '../permissions';
import { AuthenticatedUser } from '../types';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const granted = new Set(request.user?.permissions ?? []);
    const missing = required.filter((permission) => !granted.has(permission));
    if (missing.length === 0) {
      return true;
    }

    // OPTIONAL (decision gate 6): the interceptor never runs for a request the guard rejects,
    // so a denial is only on the record if the guard writes it.
    await this.audit.record({
      actorId: request.user?.id,
      action: `${request.method} ${request.route?.path ?? request.url}`,
      outcome: 'denied',
      summary: `Missing permission(s): ${missing.join(', ')}`,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    throw new ForbiddenException('Insufficient permissions');
  }
}
