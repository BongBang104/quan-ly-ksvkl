import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('fatigue_reports')
export class FatigueReport {
  @PrimaryColumn()                                 id:                 string;
  @Column({ unique: true })                        anonCode:           string;
  @Column({ nullable: true })                      reporterId:         string;
  @Column({ nullable: true })                      facility:           string;
  @Column({ nullable: true })                      shiftType:          string;
  @Column({ type: 'timestamptz', nullable: true }) shiftStart:         Date;
  @Column({ type: 'timestamptz', nullable: true }) shiftEnd:           Date;
  @Column({ nullable: true })                      contact:            string;
  @Column()                                        fatigueOnset:       string;
  @Column({ type: 'int' })                         kssScore:           number;
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true }) sleepHours72: number;
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true }) sleepHours24: number;
  @Column({ nullable: true })                      sleepQuality:       string;
  @Column({ type: 'text' })                        impactDescription:  string;
  @Column({ type: 'jsonb', default: '[]' })        factorsSchedule:    string[];
  @Column({ type: 'jsonb', default: '[]' })        factorsOperation:   string[];
  @Column({ type: 'jsonb', default: '[]' })        factorsPersonal:    string[];
  @Column({ type: 'text', nullable: true })        factorsOther:       string;
  @Column({ type: 'text', nullable: true })        immediateAction:    string;
  @Column({ default: 'submitted' })                status:             string;
  @Column({ nullable: true })                      acknowledgedBy:     string;
  @Column({ type: 'timestamptz', nullable: true }) acknowledgedAt:     Date;
  @Column({ default: false })                      safetyNotified:     boolean;
  @Column({ type: 'timestamptz', nullable: true }) safetyNotifiedAt:   Date;
  @Column({ type: 'text', nullable: true })        analysisNote:       string;
  @Column({ type: 'timestamptz', nullable: true }) closedAt:           Date;
  @Column({ default: false })                      isRedLine:          boolean;
  @Column({ nullable: true })                      redLineReason:      string;
  @Column({ type: 'jsonb', default: '{}' })        extraData:          Record<string, any>;
  @CreateDateColumn()                              createdAt:          Date;
  @UpdateDateColumn()                              updatedAt:          Date;
}
