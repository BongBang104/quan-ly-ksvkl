import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftExchange }              from './shift-exchange.entity';
import { ShiftExchangesController }   from './shift-exchanges.controller';
import { ShiftExchangesService }      from './shift-exchanges.service';
import { NotificationsModule }        from '../notifications/notifications.module';
import { AnalyticsModule }            from '../analytics/analytics.module';
import { Employee }                   from '../employees/employee.entity';
import { Schedule }                   from '../schedules/schedule.entity';

@Module({
  imports:     [
    TypeOrmModule.forFeature([ShiftExchange, Employee, Schedule]),
    NotificationsModule,
    AnalyticsModule,
  ],
  controllers: [ShiftExchangesController],
  providers:   [ShiftExchangesService],
  exports:     [ShiftExchangesService],
})
export class ShiftExchangesModule {}
