import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('activities')
export class Activity {
  @PrimaryColumn()           id: string;
  @Column({ name: 'employeeId' }) empId: string;
  @Column()                  type: string;
  @Column({ nullable: true }) note: string;
  @Column({ type: 'date' })  startDate: string;
  @Column({ type: 'date' })  endDate: string;
  @Column({ nullable: true }) approvedBy: string;
  @Column({ default: 'pending' }) status: string;
  @CreateDateColumn()        createdAt: Date;
  @UpdateDateColumn()        updatedAt: Date;
}
