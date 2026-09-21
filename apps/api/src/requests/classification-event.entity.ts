import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CustomerRequest } from './customer-request.entity';

/**
 * Append-only record of one classification run. The message is snapshotted so
 * history stays meaningful even for ad-hoc classifications with no request.
 */
@Entity({ name: 'classification_events' })
export class ClassificationEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CustomerRequest, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'request_id' })
  request!: CustomerRequest | null;

  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId!: string | null;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 32 })
  category!: string;

  @Column({ type: 'float' })
  confidence!: number;

  @Column({ type: 'varchar', length: 64 })
  provider!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
