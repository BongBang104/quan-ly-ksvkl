import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee }          from '../employees/employee.entity';
import { AnalyticsClient }   from './analytics.client';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports:     [TypeOrmModule.forFeature([Employee])],
  controllers: [AnalyticsController],
  providers:   [AnalyticsClient],
  exports:     [AnalyticsClient],
})
export class AnalyticsModule {}
