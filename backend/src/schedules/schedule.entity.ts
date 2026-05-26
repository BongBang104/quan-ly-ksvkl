import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('schedules')
export class Schedule {
  // e.g. "2025-06"
  @PrimaryColumn()         monthKey: string;
  @Column({ type: 'jsonb' }) data: Record<string, any>;
  @UpdateDateColumn()      updatedAt: Date;
}
