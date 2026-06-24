import { Controller, Get, Put, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { RolesGuard }      from '../auth/roles.guard';
import { Roles }           from '../auth/roles.decorator';
import { RequestsService } from './requests.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Controller('api/requests')
export class RequestsController {
  constructor(
    private readonly svc: RequestsService,
    private readonly notify: NotificationsGateway,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() { return this.svc.findAll(); }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')
  async replaceAll(@Body() body: { list: any[] }) {
    const result = await this.svc.replaceAll(body.list);
    this.notify.broadcastNotification('requests:updated', {});
    return result;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() body: any) {
    const req = await this.svc.upsertOne(body);
    this.notify.broadcastNotification('request:new', {
      id: req.id, type: req.type,
      requesterName: req.requesterName, requesterTeam: req.requesterTeam,
    });
    return req;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async update(@Param('id') id: string, @Body() body: any) {
    const req = await this.svc.upsertOne({ ...body, id });
    this.notify.broadcastNotification('request:updated', { id, status: req.status, employeeId: req.employeeId });
    return req;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
    this.notify.broadcastNotification('request:deleted', { id });
  }
}
