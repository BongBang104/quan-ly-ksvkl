import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule }          from './auth/auth.module';
import { EmployeesModule }     from './employees/employees.module';
import { SettingsModule }      from './settings/settings.module';
import { ActivitiesModule }    from './activities/activities.module';
import { SchedulesModule }     from './schedules/schedules.module';
import { TasksModule }         from './tasks/tasks.module';
import { RequestsModule }      from './requests/requests.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule }        from './health/health.module';
import { AnalyticsModule }       from './analytics/analytics.module';
import { FatigueReportsModule }  from './fatigue-reports/fatigue-reports.module';
import { ShiftExchangesModule }  from './shift-exchanges/shift-exchanges.module';
import { ShiftBriefingsModule }  from './shift-briefings/shift-briefings.module';
import { ShiftHandoversModule }  from './shift-handovers/shift-handovers.module';
import { AuditModule }           from './audit/audit.module';

import { Employee }             from './employees/employee.entity';
import { Setting }              from './settings/settings.entity';
import { Activity }             from './activities/activity.entity';
import { Schedule }             from './schedules/schedule.entity';
import { Shift }                from './schedules/shift.entity';
import { ShiftPositionSession } from './schedules/shift-position-session.entity';
import { Task }                 from './tasks/task.entity';
import { Request }              from './requests/request.entity';
import { FatigueReport }        from './fatigue-reports/fatigue-report.entity';
import { ShiftExchange }        from './shift-exchanges/shift-exchange.entity';
import { ShiftBriefing }        from './shift-briefings/shift-briefing.entity';
import { ShiftHandover }        from './shift-handovers/shift-handover.entity';
import { AuditLog }             from './audit/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    ScheduleModule.forRoot(),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host:     cfg.get('DB_HOST',  'localhost'),
        port:     parseInt(cfg.get('DB_PORT', '5432')),
        username: cfg.get('DB_USER',  'postgres'),
        password: cfg.get('DB_PASS',  'postgres'),
        database: cfg.get('DB_NAME',  'atc_pro'),
        entities: [Employee, Setting, Activity, Schedule, Shift, ShiftPositionSession, Task, Request, FatigueReport, ShiftExchange, ShiftBriefing, ShiftHandover, AuditLog],
        synchronize: false, // Schema do migration.sql quản lý. KHÔNG bật trong production.
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
    AnalyticsModule,
    FatigueReportsModule,
    ShiftExchangesModule,
    ShiftBriefingsModule,
    ShiftHandoversModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
