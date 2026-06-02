import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('shift_exchanges')
export class ShiftExchange {
  @PrimaryColumn()                                 id:                    string;
  @Column()                                        type:                  string;   // EXCHANGE | COVER
  @Column({ default: 'ACC_APP_TWR' })              facilityType:          string;
  @Column({ default: 'KSVKL' })                    applicantRole:         string;
  @Column()                                        applicantId:           string;
  @Column()                                        applicantName:         string;
  @Column({ nullable: true })                      applicantTeam:         string;
  @Column({ type: 'date' })                        applicantShiftDate:    string;
  @Column()                                        applicantShiftCode:    string;
  @Column()                                        counterpartyId:        string;
  @Column()                                        counterpartyName:      string;
  @Column({ nullable: true })                      counterpartyTeam:      string;
  @Column({ type: 'date', nullable: true })        counterpartyShiftDate: string;
  @Column({ nullable: true })                      counterpartyShiftCode: string;
  @Column({ default: 'pending' })                  status:                string;
  @Column({ type: 'timestamptz', nullable: true }) counterpartyAgreedAt:  Date;
  @Column({ nullable: true })                      chiefApproverId:       string;
  @Column({ nullable: true })                      chiefApproverRole:     string;
  @Column({ type: 'timestamptz', nullable: true }) chiefApprovedAt:       Date;
  @Column({ nullable: true })                      chiefApproverId2:      string;
  @Column({ type: 'timestamptz', nullable: true }) chiefApproved2At:      Date;
  @Column({ type: 'text', nullable: true })        rejectionReason:       string;
  @Column({ type: 'jsonb', nullable: true })       precheckResult:        Record<string, any>;
  @Column({ type: 'jsonb', default: '{}' })        extraData:             Record<string, any>;
  @CreateDateColumn()                              createdAt:             Date;
  @UpdateDateColumn()                              updatedAt:             Date;
}
