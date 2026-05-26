import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { Activity }               from './activity.entity';
import { ActivitiesController }   from './activities.controller';
import { ActivitiesService }      from './activities.service';
import { NotificationsModule }    from '../notifications/notifications.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Activity]), NotificationsModule],
  controllers: [ActivitiesController],
  providers:   [ActivitiesService],
  exports:     [ActivitiesService],
})
export class ActivitiesModule {}
