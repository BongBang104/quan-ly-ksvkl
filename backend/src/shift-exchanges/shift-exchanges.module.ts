import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShiftExchange }              from './shift-exchange.entity';
import { ShiftExchangesController }   from './shift-exchanges.controller';
import { ShiftExchangesService }      from './shift-exchanges.service';
import { NotificationsModule }        from '../notifications/notifications.module';

@Module({
  imports:     [TypeOrmModule.forFeature([ShiftExchange]), NotificationsModule],
  controllers: [ShiftExchangesController],
  providers:   [ShiftExchangesService],
  exports:     [ShiftExchangesService],
})
export class ShiftExchangesModule {}
