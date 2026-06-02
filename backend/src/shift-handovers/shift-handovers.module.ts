import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftHandover }             from './shift-handover.entity';
import { ShiftHandoversController }  from './shift-handovers.controller';
import { ShiftHandoversService }     from './shift-handovers.service';

@Module({
  imports:     [TypeOrmModule.forFeature([ShiftHandover])],
  controllers: [ShiftHandoversController],
  providers:   [ShiftHandoversService],
  exports:     [ShiftHandoversService],
})
export class ShiftHandoversModule {}
