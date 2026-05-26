import { Controller, Get, Put, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }      from '../auth/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Controller('api/activities')
export class ActivitiesController {
  constructor(
    private readonly svc: ActivitiesService,
    private readonly notify: NotificationsGateway,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() { return this.svc.findAll(); }

  @Put()
  @UseGuards(JwtAuthGuard)
  async replaceAll(@Body() body: { list: any[] }) {
    const result = await this.svc.replaceAll(body.list);
    this.notify.broadcastNotification('activities:updated', {});
    return result;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: any) {
    const activity = await this.svc.upsertOne(body);
    this.notify.broadcastNotification('activity:new', { empId: activity.empId, type: activity.type });
    return activity;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() body: any) {
    const activity = await this.svc.upsertOne({ ...body, id });
    this.notify.broadcastNotification('activity:updated', { id });
    return activity;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
    this.notify.broadcastNotification('activity:deleted', { id });
  }
}
