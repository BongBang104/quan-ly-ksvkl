import { Module }        from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request }              from './request.entity';
import { RequestsController }   from './requests.controller';
import { RequestsService }      from './requests.service';
import { NotificationsModule }  from '../notifications/notifications.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Request]), NotificationsModule],
  controllers: [RequestsController],
  providers:   [RequestsService],
})
export class RequestsModule {}
