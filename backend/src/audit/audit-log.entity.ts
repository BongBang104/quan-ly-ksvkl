import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ nullable: true }) actorId:      string;
  @Column({ nullable: true }) actorName:    string;
  @Column()                   action:       string;
  @Column({ nullable: true }) resourceType: string;
  @Column({ nullable: true }) resourceId:   string;
  @Column({ type: 'jsonb', nullable: true }) payload: object;
  @Column({ nullable: true }) ip:           string;
  @Column({ nullable: true }) userAgent:    string;
  @CreateDateColumn()         createdAt:    Date;
}
