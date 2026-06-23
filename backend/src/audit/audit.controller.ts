import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { AuditService }    from './audit.service';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  findAll(@Query('limit') limit?: string) {
    return this.svc.findAll(limit ? parseInt(limit) : 200);
  }
}
