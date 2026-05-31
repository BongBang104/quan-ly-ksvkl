import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('employees')
export class Employee {
  @PrimaryColumn() id:          string;
  @Column()        name:        string;
  @Column({ nullable: true }) icaoCode:     string;
  @Column({ nullable: true }) team:         string;
  @Column({ default: 'STAFF' }) role:       string;
  @Column({ nullable: true }) position:     string;
  @Column({ nullable: true }) qualification: string;
  @Column({ type: 'date', nullable: true }) qualificationExpiresAt: string;
  @Column({ default: true }) qualificationIsActive: boolean;
  @Column({ default: false }) isChief:      boolean;
  @Column({ default: false }) isVip:        boolean;
  @Column({ nullable: true }) phone:        string;
  @Column({ nullable: true }) email:        string;
  @Column() password: string;
  @Column({ default: true }) isFirstLogin:  boolean;
  @Column({ default: true }) isApproved:    boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
