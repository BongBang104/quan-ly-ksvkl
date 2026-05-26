import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('shift_position_sessions')
export class ShiftPositionSession {
  @PrimaryColumn()                    id:       string; // shiftId|position|start_iso
  @Index()
  @Column()                           shiftId:  string;
  @Column()                           position: string; // APP | CTL | TWR | GCU
  @Column({ type: 'timestamptz' })    start:    Date;
  @Column({ type: 'timestamptz' })    end:      Date;
}
