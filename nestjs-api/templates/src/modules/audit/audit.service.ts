import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditOutcome } from './entities/audit-log.entity';

export interface AuditRecord {
  actorId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome: AuditOutcome;
  summary?: string;
  ip?: string;
  userAgent?: string;
}

// Append-only by design: there is no update or delete here, and no endpoint may add one.
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  async record(entry: AuditRecord): Promise<void> {
    try {
      await this.logs.insert({
        actorId: entry.actorId ?? null,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        outcome: entry.outcome,
        summary: entry.summary ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      });
    } catch (err) {
      this.logger.error(
        `Failed to record audit "${entry.action}"`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
