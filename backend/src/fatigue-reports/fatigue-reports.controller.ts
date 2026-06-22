import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsInt, Min, Max, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard }  from '../auth/jwt-auth.guard';
import { RolesGuard }    from '../auth/roles.guard';
import { Roles }         from '../auth/roles.decorator';
import { FatigueReportsService } from './fatigue-reports.service';
import { NotificationsGateway }  from '../notifications/notifications.gateway';

class CreateFatigueReportDto {
  @IsOptional() @IsString()   facility?:          string;
  @IsOptional() @IsString()   shiftType?:         string;
  @IsOptional() @IsString()   shiftStart?:        string;
  @IsOptional() @IsString()   shiftEnd?:          string;
  @IsOptional() @IsString()   contact?:           string;
  @IsString()                 fatigueOnset!:      string;
  @IsInt() @Min(1) @Max(9)
  @Type(() => Number)         kssScore!:          number;
  @IsOptional()               sleepHours72?:      number;
  @IsOptional()               sleepHours24?:      number;
  @IsOptional() @IsString()   sleepQuality?:      string;
  @IsString()                 impactDescription!: string;
  @IsArray()                  factorsSchedule!:   string[];
  @IsArray()                  factorsOperation!:  string[];
  @IsArray()                  factorsPersonal!:   string[];
  @IsOptional() @IsString()   factorsOther?:      string;
  @IsOptional() @IsString()   immediateAction?:   string;
}

@Controller('api/fatigue-reports')
export class FatigueReportsController {
  constructor(
    private readonly svc:    FatigueReportsService,
    private readonly notify: NotificationsGateway,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateFatigueReportDto, @Req() req: any) {
    const report = await this.svc.create({
      ...dto,
      shiftStart: dto.shiftStart ? new Date(dto.shiftStart) : undefined,
      shiftEnd:   dto.shiftEnd   ? new Date(dto.shiftEnd)   : undefined,
      reporterId: req.user?.id ?? null,
    });
    this.notify.broadcastNotification('fatigue:new', {
      anonCode: report.anonCode,
      kssScore: report.kssScore,
    });
    return { anonCode: report.anonCode, id: report.id };
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req: any) {
    return this.svc.findMine(req.user.id);
  }

  @Get('for-chief')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  findForChief() {
    return this.svc.findForChief();
  }

  @Put(':id/acknowledge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  ack(@Param('id') id: string, @Req() req: any) {
    return this.svc.acknowledge(id, req.user.id);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  summary(@Query('start') start: string, @Query('end') end: string) {
    return this.svc.findAnonymizedSummary(new Date(start), new Date(end));
  }
}
