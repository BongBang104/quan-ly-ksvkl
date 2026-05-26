import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'jsonb' }) config: Record<string, any>;
  @UpdateDateColumn() updatedAt: Date;
}
