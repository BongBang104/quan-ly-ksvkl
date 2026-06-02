import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard }   from '../auth/roles.guard';
import { Roles }        from '../auth/roles.decorator';
import { ShiftBriefingsService } from './shift-briefings.service';

class CreateBriefingDto {
  @IsString()                 team!:           string;
  @IsString()                 shiftDate!:      string;
  @IsString()                 shiftCode!:      string;
  @IsOptional() @IsString()   level?:          string;
  @IsString()                 chairId!:        string;
  @IsString()                 chairName!:      string;
  @IsOptional() @IsString()   chairRole?:      string;
  @IsOptional() @IsArray()    participants?:   any[];
  @IsOptional() @IsString()   facilityRepId?:  string;
  @IsOptional() @IsString()   facilityRepName?: string;
}

class UpdateBriefingDto {
  @IsOptional() @IsString()   briefingContent?:    string;
  @IsOptional() @IsString()   recommendations?:    string;
  @IsOptional() @IsString()   level?:              string;
  @IsOptional() @IsBoolean()  hasSafetyEvent?:     boolean;
  @IsOptional() @IsString()   safetyEventSummary?: string;
  @IsOptional() @IsArray()    formalRecipients?:   any[];
}

@Controller('api/shift-briefings')
export class ShiftBriefingsController {
  constructor(private readonly svc: ShiftBriefingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  create(@Body() dto: CreateBriefingDto) {
    return this.svc.create({ ...dto, level: dto.level ?? 'light', briefingContent: '' });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findRecent(@Query('days') days?: string) {
    return this.svc.findRecent(days ? parseInt(days) : 30);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  update(@Param('id') id: string, @Body() dto: UpdateBriefingDto) {
    return this.svc.update(id, dto);
  }
}
