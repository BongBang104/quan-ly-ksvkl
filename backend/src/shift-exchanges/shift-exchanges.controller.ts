import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard }   from '../auth/roles.guard';
import { Roles }        from '../auth/roles.decorator';
import { ShiftExchangesService } from './shift-exchanges.service';
import { NotificationsGateway }  from '../notifications/notifications.gateway';

class CreateExchangeDto {
  @IsString() type!:                  'EXCHANGE' | 'COVER';
  @IsString() applicantShiftDate!:    string;
  @IsString() applicantShiftCode!:    string;
  @IsString() counterpartyId!:        string;
  @IsString() counterpartyName!:      string;
  @IsOptional() @IsString() counterpartyShiftDate?: string;
  @IsOptional() @IsString() counterpartyShiftCode?: string;
  @IsOptional() @IsString() facilityType?: string;
}

class PrecheckExchangeDto {
  @IsString() type!:                  'EXCHANGE' | 'COVER';
  @IsString() applicantShiftDate!:    string;
  @IsString() applicantShiftCode!:    string;
  @IsString() counterpartyId!:        string;
  @IsOptional() @IsString() counterpartyShiftDate?: string;
  @IsOptional() @IsString() counterpartyShiftCode?: string;
}

@Controller('api/shift-exchanges')
export class ShiftExchangesController {
  constructor(
    private readonly svc:    ShiftExchangesService,
    private readonly notify: NotificationsGateway,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateExchangeDto, @Req() req: any) {
    const precheck = await this.svc.runPrecheck({
      type: dto.type as 'EXCHANGE' | 'COVER',
      applicantId: req.user.sub,
      counterpartyId: dto.counterpartyId,
      applicantShiftDate: dto.applicantShiftDate,
      applicantShiftCode: dto.applicantShiftCode,
      counterpartyShiftDate: dto.counterpartyShiftDate,
      counterpartyShiftCode: dto.counterpartyShiftCode,
    });

    const ex = await this.svc.create({
      ...dto,
      applicantId: req.user.sub,
      applicantName: req.user.name ?? req.user.sub,
      facilityType: dto.facilityType ?? 'ACC_APP_TWR',
      precheckResult: precheck,
    });
    this.notify.broadcastNotification('exchange:new', { id: ex.id });
    return ex;
  }

  @Post('precheck')
  @UseGuards(JwtAuthGuard)
  async precheck(@Body() dto: PrecheckExchangeDto, @Req() req: any) {
    return this.svc.runPrecheck({
      ...dto,
      applicantId: req.user.sub,
    });
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findPending(@Req() req: any) {
    return this.svc.findPending(req.user.sub);
  }

  @Put(':id/agree')
  @UseGuards(JwtAuthGuard)
  agree(@Param('id') id: string, @Req() req: any) {
    return this.svc.counterpartyAgree(id, req.user.sub);
  }

  @Put(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  approve(
    @Param('id') id: string,
    @Body() body: { override_reason?: string },
    @Req() req: any,
  ) {
    return this.svc.chiefApprove(
      id,
      req.user.sub,
      req.user.role ?? 'CHIEF',
      body.override_reason,
    );
  }

  @Put(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  reject(@Param('id') id: string, @Body('reason') reason: string) {
    return this.svc.reject(id, reason);
  }
}
