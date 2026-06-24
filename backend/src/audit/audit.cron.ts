import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from './audit.service';

@Injectable()
export class AuditCron {
  constructor(private readonly audit: AuditService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge() {
    await this.audit.purgeOldLogs();
  }
}
