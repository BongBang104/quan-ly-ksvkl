import { Controller, Get, Put, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { RolesGuard }      from '../auth/roles.guard';
import { Roles }           from '../auth/roles.decorator';
import { RequestsService } from './requests.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushService }          from '../push/push.service';
import { UpsertRequestDto }     from './dto/upsert-request.dto';

@Controller('api/requests')
export class RequestsController {
  constructor(
    private readonly svc: RequestsService,
    private readonly notify: NotificationsGateway,
    private readonly push: PushService,
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
  async create(@Body() dto: UpsertRequestDto) {
    const req = await this.svc.upsertOne(dto);
    this.notify.broadcastNotification('request:new', {
      id: req.id, type: req.type,
      requesterName: req.requesterName, requesterTeam: req.requesterTeam,
    });
    const typeLabel = req.type ?? 'yêu cầu';
    const who = req.requesterName ? ` từ ${req.requesterName}` : '';
    this.push.sendToAll(`📝 Yêu cầu mới${who}`, typeLabel).catch(() => {});
    return req;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async update(@Param('id') id: string, @Body() dto: UpsertRequestDto) {
    const req = await this.svc.upsertOne({ ...dto, id });
    this.notify.broadcastNotification('request:updated', { id, status: req.status, employeeId: req.employeeId });
    if (req.employeeId) {
      const statusLabel = req.status === 'approved' ? 'được chấp thuận' : req.status === 'rejected' ? 'bị từ chối' : 'được cập nhật';
      this.push.sendToUsers([req.employeeId], '✅ Yêu cầu của bạn', `Yêu cầu của bạn đã ${statusLabel}.`).catch(() => {});
    }
    return req;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
    this.notify.broadcastNotification('request:deleted', { id });
  }
}
