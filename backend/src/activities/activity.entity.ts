import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('activities')
export class Activity {
  @PrimaryColumn()           id: string;
  @Index() @Column({ name: 'employeeId' }) empId: string;
  @Column()                  type: string;
  @Column({ nullable: true }) note: string;
  @Index() @Column({ type: 'date' })  startDate: string;
  @Index() @Column({ type: 'date' })  endDate: string;
  @Column({ nullable: true }) approvedBy: string;
  @Column({ default: 'pending' }) status: string;
  @CreateDateColumn()        createdAt: Date;
  @UpdateDateColumn()        updatedAt: Date;
}
