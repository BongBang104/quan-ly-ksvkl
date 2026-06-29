import { Controller, Get, Put, Post, Delete, Param, Body, UseGuards, Query, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard }   from '../auth/roles.guard';
import { Roles }        from '../auth/roles.decorator';
import { TasksService } from './tasks.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushService }          from '../push/push.service';
import { UpsertTaskDto }        from './dto/upsert-task.dto';

@Controller('api/tasks')
export class TasksController {
  constructor(
    private readonly svc: TasksService,
    private readonly notify: NotificationsGateway,
    private readonly push: PushService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findByTeam(@Query('team') team: string, @Req() req: any) {
    return this.svc.findByTeam(team, req.user?.id, req.user?.role);
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async replaceByTeam(@Query('team') team: string, @Body() body: { list: any[] }) {
    const result = await this.svc.replaceByTeam(team, body.list);
    this.notify.broadcastNotification('tasks:updated', { team });
    return result;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: UpsertTaskDto) {
    const task = await this.svc.upsertOne(dto);
    this.notify.broadcastNotification('task:new', { id: task.id, title: task.title, targetEmpIds: task.targetEmpIds });
    const targets = Array.isArray(task.targetEmpIds) && task.targetEmpIds.length
      ? task.targetEmpIds
      : null;
    if (targets) {
      this.push.sendToUsers(targets, '📋 Nhiệm vụ mới', task.title ?? 'Bạn có nhiệm vụ mới').catch(() => {});
    }
    return task;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() dto: UpsertTaskDto) {
    const prevCommentCount = Array.isArray(dto.comments) ? dto.comments.length : 0;
    const task = await this.svc.upsertOne({ ...dto, id });
    const newCommentCount = Array.isArray(task.comments) ? task.comments.length : 0;
    this.notify.broadcastNotification('task:updated', {
      id: task.id,
      title: task.title,
      targetEmpIds: task.targetEmpIds,
      hasNewComment: newCommentCount > prevCommentCount,
    });
    return task;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async remove(@Param('id') id: string, @Query('team') team?: string) {
    await this.svc.remove(id, team);
    this.notify.broadcastNotification('task:deleted', { id });
  }
}
