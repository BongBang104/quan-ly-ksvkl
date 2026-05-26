import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('requests')
export class Request {
  @PrimaryColumn()           id: string;
  @Column({ nullable: true }) employeeId: string;
  @Column()                  type: string;
  @Column({ nullable: true }) note: string;
  @Column({ type: 'date', nullable: true }) startDate: string;
  @Column({ type: 'date', nullable: true }) endDate: string;
  @Column({ default: 'pending' }) status: string;
  @Column({ nullable: true }) reviewedBy: string;
  @Column({ nullable: true }) reviewNote: string;
  // Stores all frontend-specific fields (requesterId, requesterName, date, reason, approvals, etc.)
  @Column({ type: 'jsonb', nullable: true }) extraData: Record<string, any>;
  @CreateDateColumn()        createdAt: Date;
  @UpdateDateColumn()        updatedAt: Date;
}
