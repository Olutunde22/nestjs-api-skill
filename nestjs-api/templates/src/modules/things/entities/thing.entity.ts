import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const THING_STATUSES = ['draft', 'active', 'archived'] as const;
export type ThingStatus = (typeof THING_STATUSES)[number];

@Entity({ name: 'things' })
export class Thing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Uniqueness lives in the database; the service's pre-check only gives a nicer message.
  @Column({ length: 120, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: ThingStatus;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
