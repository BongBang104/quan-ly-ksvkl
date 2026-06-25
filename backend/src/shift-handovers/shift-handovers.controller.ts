import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard }          from '../auth/jwt-auth.guard';
import { RolesGuard }            from '../auth/roles.guard';
import { Roles }                 from '../auth/roles.decorator';
import { ShiftHandoversService } from './shift-handovers.service';

class UpsertHandoverDto {
  @IsString()                 team!:        string;
  @IsString()                 handoverDate!: string;
  @IsString()                 shiftCode!:   string;
}

class UpdateHandoverDto {
  @IsOptional() @IsString() weather?:   string;
  @IsOptional() @IsString() equipment?: string;
  @IsOptional() @IsString() situation?: string;
  @IsOptional() @IsString() traffic?:   string;
}

@Controller('api/shift-handovers')
export class ShiftHandoversController {
  constructor(private readonly svc: ShiftHandoversService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  createOrGet(@Body() dto: UpsertHandoverDto) {
    return this.svc.createOrGet(dto.team, dto.handoverDate, dto.shiftCode);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findByTeamDate(@Query('team') team: string, @Query('date') date: string) {
    return this.svc.findByTeamDate(team, date);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  update(@Param('id') id: string, @Body() dto: UpdateHandoverDto) {
    return this.svc.update(id, dto);
  }

  @Put(':id/sign-outgoing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  signOutgoing(@Param('id') id: string, @Req() req: any) {
    return this.svc.signOutgoing(id, req.user.id, req.user.name ?? req.user.id);
  }

  @Put(':id/sign-incoming')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  signIncoming(@Param('id') id: string, @Req() req: any) {
    return this.svc.signIncoming(id, req.user.id, req.user.name ?? req.user.id);
  }
}
