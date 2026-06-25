import { Controller, Get, Put, Post, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { RolesGuard }      from '../auth/roles.guard';
import { Roles }           from '../auth/roles.decorator';
import { EmployeesService } from './employees.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Controller('api/employees')
export class EmployeesController {
  constructor(
    private readonly svc: EmployeesService,
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
    this.notify.broadcastNotification('employees:updated', {});
    return result;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')
  async create(@Body() body: any) {
    const result = await this.svc.upsertOne(body, true);
    this.notify.broadcastNotification('employees:updated', {});
    return result;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')
  async update(@Param('id') id: string, @Body() body: any) {
    const result = await this.svc.upsertOne({ ...body, id });
    this.notify.broadcastNotification('employees:updated', {});
    return result;
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async setApproved(@Param('id') id: string, @Body() body: { isApproved: boolean }) {
    const result = await this.svc.setApproved(id, body.isApproved);
    this.notify.broadcastNotification('employees:updated', {});
    return result;
  }

  @Patch(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')
  resetPassword(@Param('id') id: string) {
    return this.svc.resetPassword(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
    this.notify.broadcastNotification('employees:updated', {});
  }
}
