import { Controller, Get, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }      from '../auth/jwt-auth.guard';
import { SchedulesService }  from './schedules.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Controller('api/schedules')
export class SchedulesController {
  constructor(
    private readonly svc: SchedulesService,
    private readonly notify: NotificationsGateway,
  ) {}

  @Post('notify-roster')
  @UseGuards(JwtAuthGuard)
  notifyRoster(
    @Body() body: { team: string; date: string; shift: string; empAssignments: Record<string, any[]> },
  ) {
    this.notify.broadcastNotification('roster:published', body);
    return { ok: true };
  }

  @Get(':monthKey')
  @UseGuards(JwtAuthGuard)
  findByMonth(@Param('monthKey') monthKey: string) {
    return this.svc.findByMonth(monthKey);
  }

  @Put(':monthKey')
  @UseGuards(JwtAuthGuard)
  async saveMonth(
    @Param('monthKey') monthKey: string,
    @Body() body: { data: Record<string, any> },
  ) {
    const result = await this.svc.saveMonth(monthKey, body.data);
    if (body.data?.isPublished) {
      await this.svc.populateShifts(monthKey, body.data);
      this.notify.broadcastNotification('schedule:published', {
        monthKey,
        message: `Quản lý vừa phát hành Lịch trực tháng ${monthKey}.`,
      });
    }
    return result;
  }
}
