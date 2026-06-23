import { Controller, Get, Put, Post, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { RolesGuard }      from '../auth/roles.guard';
import { Roles }           from '../auth/roles.decorator';
import { EmployeesService } from './employees.service';

@Controller('api/employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() { return this.svc.findAll(); }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')
  replaceAll(@Body() body: { list: any[] }) {
    return this.svc.replaceAll(body.list);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')
  create(@Body() body: any) {
    return this.svc.upsertOne(body, true);  // isNew=true → backend sinh password
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin')
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.upsertOne({ ...body, id });  // isNew=false (default) → giữ password
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  setApproved(@Param('id') id: string, @Body() body: { isApproved: boolean }) {
    return this.svc.setApproved(id, body.isApproved);
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
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
