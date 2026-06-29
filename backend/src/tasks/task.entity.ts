import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryColumn()           id: string;
  @PrimaryColumn({ default: 'ALL' }) team: string;
  @Column()                  title: string;
  @Column({ nullable: true }) description: string;
  @Column({ nullable: true }) priority: string;
  @Index() @Column({ nullable: true }) status: string;
  @Column({ nullable: true }) assignedTo: string;
  @Column({ nullable: true }) dueDate: string;
  @Index() @Column({ nullable: true }) createdBy: string;
  @Column({ nullable: true, default: 'team' }) visibility: string;
  @Column({ type: 'jsonb', default: '[]' }) targetEmpIds: string[];
  @Column({ type: 'jsonb', default: '[]' }) comments: Record<string, any>[];
  @Column({ type: 'jsonb', default: '[]' }) acknowledgments: Record<string, any>[];
  // Stores frontend-specific fields: type, content, date, authorId, authorName, isChatLocked, conclusion, etc.
  @Column({ type: 'jsonb', nullable: true }) extraData: Record<string, any>;
  @CreateDateColumn()        createdAt: Date;
  @UpdateDateColumn()        updatedAt: Date;
}
