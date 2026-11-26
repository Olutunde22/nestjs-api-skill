import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AuditOutcome = 'success' | 'error' | 'denied';

@Entity({ name: 'audit_logs' })
@Index(['resourceType', 'resourceId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ length: 120 })
  action: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 60, nullable: true })
  resourceType: string | null;

  @Column({ name: 'resource_id', type: 'varchar', length: 120, nullable: true })
  resourceId: string | null;

  @Column({ type: 'varchar', length: 10 })
  outcome: AuditOutcome;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
