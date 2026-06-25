import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';
import { Employee }             from './employee.entity';
import { EmployeesController }  from './employees.controller';
import { EmployeesService }     from './employees.service';
import { NotificationsModule }  from '../notifications/notifications.module';

@Module({
  imports:     [TypeOrmModule.forFeature([Employee]), NotificationsModule],
  controllers: [EmployeesController],
  providers:   [EmployeesService],
  exports:     [EmployeesService],
})
export class EmployeesModule {}
