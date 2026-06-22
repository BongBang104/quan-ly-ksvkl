import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard }         from '../auth/jwt-auth.guard';
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
  @UseGuards(JwtAuthGuard)
  createOrGet(@Body() dto: UpsertHandoverDto) {
    return this.svc.createOrGet(dto.team, dto.handoverDate, dto.shiftCode);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findByTeamDate(@Query('team') team: string, @Query('date') date: string) {
    return this.svc.findByTeamDate(team, date);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateHandoverDto) {
    return this.svc.update(id, dto);
  }

  @Put(':id/sign-outgoing')
  @UseGuards(JwtAuthGuard)
  signOutgoing(@Param('id') id: string, @Req() req: any) {
    return this.svc.signOutgoing(id, req.user.id, req.user.name ?? req.user.id);
  }

  @Put(':id/sign-incoming')
  @UseGuards(JwtAuthGuard)
  signIncoming(@Param('id') id: string, @Req() req: any) {
    return this.svc.signIncoming(id, req.user.id, req.user.name ?? req.user.id);
  }
}
