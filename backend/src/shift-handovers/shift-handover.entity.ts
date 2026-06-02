import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('shift_handovers')
export class ShiftHandover {
  @PrimaryColumn()                                 id:                  string;
  @Column()                                        team:                string;
  @Column({ type: 'date' })                        handoverDate:        string;
  @Column()                                        shiftCode:           string;
  @Column({ type: 'text', default: '' })           weather:             string;
  @Column({ type: 'text', default: '' })           equipment:           string;
  @Column({ type: 'text', default: '' })           situation:           string;
  @Column({ type: 'text', default: '' })           traffic:             string;
  @Column({ default: 'draft' })                    status:              string;
  @Column({ nullable: true })                      outgoingSignerId:    string;
  @Column({ nullable: true })                      outgoingSignerName:  string;
  @Column({ type: 'timestamptz', nullable: true }) outgoingSignedAt:    Date;
  @Column({ nullable: true })                      incomingSignerId:    string;
  @Column({ nullable: true })                      incomingSignerName:  string;
  @Column({ type: 'timestamptz', nullable: true }) incomingSignedAt:    Date;
  @Column({ type: 'jsonb', default: '{}' })        extraData:           Record<string, any>;
  @CreateDateColumn()                              createdAt:           Date;
  @UpdateDateColumn()                              updatedAt:           Date;
}
