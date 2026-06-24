import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request }              from './request.entity';
import { RequestsController }   from './requests.controller';
import { RequestsService }      from './requests.service';
import { NotificationsModule }  from '../notifications/notifications.module';
import { PushModule }           from '../push/push.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Request]), NotificationsModule, PushModule],
  controllers: [RequestsController],
  providers:   [RequestsService],
})
export class RequestsModule {}
