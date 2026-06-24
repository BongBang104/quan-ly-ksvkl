import { Controller, Get, Put, Post, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard }   from '../auth/roles.guard';
import { Roles }        from '../auth/roles.decorator';
import { TasksService } from './tasks.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Controller('api/tasks')
export class TasksController {
  constructor(
    private readonly svc: TasksService,
    private readonly notify: NotificationsGateway,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findByTeam(@Query('team') team?: string) {
    return this.svc.findByTeam(team);
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
  async create(@Body() body: any) {
    const task = await this.svc.upsertOne(body);
    this.notify.broadcastNotification('task:new', { id: task.id, title: task.title, targetEmpIds: task.targetEmpIds });
    return task;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() body: any) {
    const task = await this.svc.upsertOne({ ...body, id });
    this.notify.broadcastNotification('task:updated', { id: task.id, title: task.title });
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
