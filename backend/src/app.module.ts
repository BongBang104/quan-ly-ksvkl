import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule }          from './auth/auth.module';
import { EmployeesModule }     from './employees/employees.module';
import { SettingsModule }      from './settings/settings.module';
import { ActivitiesModule }    from './activities/activities.module';
import { SchedulesModule }     from './schedules/schedules.module';
import { TasksModule }         from './tasks/tasks.module';
import { RequestsModule }      from './requests/requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule }        from './health/health.module';

import { Employee }             from './employees/employee.entity';
import { Setting }              from './settings/settings.entity';
import { Activity }             from './activities/activity.entity';
import { Schedule }             from './schedules/schedule.entity';
import { Shift }                from './schedules/shift.entity';
import { ShiftPositionSession } from './schedules/shift-position-session.entity';
import { Task }                 from './tasks/task.entity';
import { Request }              from './requests/request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host:     cfg.get('DB_HOST',  'localhost'),
        port:     parseInt(cfg.get('DB_PORT', '5432')),
        username: cfg.get('DB_USER',  'postgres'),
        password: cfg.get('DB_PASS',  'postgres'),
        database: cfg.get('DB_NAME',  'atc_pro'),
        entities: [Employee, Setting, Activity, Schedule, Shift, ShiftPositionSession, Task, Request],
        synchronize: true, // Auto-create tables — disable in production, use migrations
        logging: false,
      }),
    }),

    AuthModule,
    EmployeesModule,
    SettingsModule,
    ActivitiesModule,
    SchedulesModule,
    TasksModule,
    RequestsModule,
    NotificationsModule,
    HealthModule,
  ],
})
export class AppModule {}
