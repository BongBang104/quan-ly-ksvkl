import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('shifts')
export class Shift {
  @PrimaryColumn()                    id:             string; // e.g. "2026-5|EMP1|2026-06-01|S"
  @Index()
  @Column()                           monthKey:       string;
  @Column()                           controllerId:   string;
  @Column()                           controllerName: string;
  @Column()                           shiftCode:      string;
  @Column({ type: 'timestamptz' })    start:          Date;
  @Column({ type: 'timestamptz' })    end:            Date;
  @Column({ default: false })         isNight:        boolean;
}
