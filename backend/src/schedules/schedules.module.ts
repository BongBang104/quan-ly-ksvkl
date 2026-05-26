import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { Schedule }               from './schedule.entity';
import { Shift }                  from './shift.entity';
import { ShiftPositionSession }   from './shift-position-session.entity';
import { SchedulesController }    from './schedules.controller';
import { SchedulesService }       from './schedules.service';
import { NotificationsModule }    from '../notifications/notifications.module';
import { Employee }               from '../employees/employee.entity';
import { Setting }                from '../settings/settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, Shift, ShiftPositionSession, Employee, Setting]),
    NotificationsModule,
  ],
  controllers: [SchedulesController],
  providers:   [SchedulesService],
})
export class SchedulesModule {}
