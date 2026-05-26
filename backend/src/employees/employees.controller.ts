import { Controller, Get, Put, Post, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }    from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { EmployeesService } from './employees.service';

@Controller('api/employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() { return this.svc.findAll(); }

  @Put()
  @UseGuards(JwtAuthGuard)
  replaceAll(@Body() body: { list: any[] }) {
    return this.svc.replaceAll(body.list);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: any) { return this.svc.upsertOne(body); }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() body: any) {
    return this.svc.upsertOne({ ...body, id });
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  setApproved(@Param('id') id: string, @Body() body: { isApproved: boolean }) {
    return this.svc.setApproved(id, body.isApproved);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
