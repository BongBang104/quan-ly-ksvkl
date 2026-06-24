import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditCron } from './audit.cron';

@Module({
  imports:     [TypeOrmModule.forFeature([AuditLog])],
  providers:   [AuditService, AuditCron],
  controllers: [AuditController],
  exports:     [AuditService],
})
export class AuditModule {}
