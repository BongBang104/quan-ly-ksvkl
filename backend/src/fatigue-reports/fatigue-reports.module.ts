import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FatigueReport }            from './fatigue-report.entity';
import { FatigueReportsController } from './fatigue-reports.controller';
import { FatigueReportsService }    from './fatigue-reports.service';
import { NotificationsModule }      from '../notifications/notifications.module';

@Module({
  imports:     [TypeOrmModule.forFeature([FatigueReport]), NotificationsModule],
  controllers: [FatigueReportsController],
  providers:   [FatigueReportsService],
  exports:     [FatigueReportsService],
})
export class FatigueReportsModule {}
