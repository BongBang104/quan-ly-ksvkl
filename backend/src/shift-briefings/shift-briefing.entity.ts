import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('shift_briefings')
export class ShiftBriefing {
  @PrimaryColumn()                                 id:                  string;
  @Column()                                        team:                string;
  @Column({ type: 'date' })                        shiftDate:           string;
  @Column()                                        shiftCode:           string;
  @Column({ default: 'light' })                    level:               string;
  @Column()                                        chairId:             string;
  @Column()                                        chairName:           string;
  @Column({ nullable: true })                      chairRole:           string;
  @Column({ type: 'jsonb', default: '[]' })        participants:        any[];
  @Column({ nullable: true })                      facilityRepId:       string;
  @Column({ nullable: true })                      facilityRepName:     string;
  @Column({ type: 'text', default: '' })           briefingContent:     string;
  @Column({ type: 'jsonb', default: '[]' })        participantComments: any[];
  @Column({ type: 'text', nullable: true })        recommendations:     string;
  @Column({ type: 'jsonb', default: '[]' })        formalRecipients:    any[];
  @Column({ default: false })                      hasSafetyEvent:      boolean;
  @Column({ type: 'text', nullable: true })        safetyEventSummary:  string;
  @Column({ type: 'jsonb', default: '{}' })        extraData:           Record<string, any>;
  @CreateDateColumn()                              createdAt:           Date;
  @UpdateDateColumn()                              updatedAt:           Date;
}
