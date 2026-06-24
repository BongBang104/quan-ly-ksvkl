import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task }               from './task.entity';
import { TasksController }    from './tasks.controller';
import { TasksService }       from './tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule }          from '../push/push.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Task]), NotificationsModule, PushModule],
  controllers: [TasksController],
  providers:   [TasksService],
})
export class TasksModule {}
