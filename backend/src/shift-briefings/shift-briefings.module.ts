import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftBriefing }             from './shift-briefing.entity';
import { ShiftBriefingsController }  from './shift-briefings.controller';
import { ShiftBriefingsService }     from './shift-briefings.service';

@Module({
  imports:     [TypeOrmModule.forFeature([ShiftBriefing])],
  controllers: [ShiftBriefingsController],
  providers:   [ShiftBriefingsService],
  exports:     [ShiftBriefingsService],
})
export class ShiftBriefingsModule {}
