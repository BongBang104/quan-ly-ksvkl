import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee }          from '../employees/employee.entity';
import { Schedule }          from '../schedules/schedule.entity';
import { AnalyticsClient }   from './analytics.client';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Employee, Schedule])],
  controllers: [AnalyticsController],
  providers:   [AnalyticsClient],
  exports:     [AnalyticsClient],
})
export class AnalyticsModule {}
