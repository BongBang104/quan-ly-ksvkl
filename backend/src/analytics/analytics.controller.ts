import {
  Body, Controller, Get, Param, Post,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IsString, IsArray, IsOptional } from 'class-validator';
import { JwtAuthGuard }  from '../auth/jwt-auth.guard';
import { RolesGuard }    from '../auth/roles.guard';
import { Roles }         from '../auth/roles.decorator';
import { Employee }      from '../employees/employee.entity';
import { AnalyticsClient } from './analytics.client';

// ── DTOs ─────────────────────────────────────────────────────────────────────

class ReviewDraftDto {
  @IsString()                team!:        string;
  @IsString()                shift_code!:  string;
  @IsString()                shift_date!:  string;
  @IsArray()                 rows!:        any[];
}

class MacroReviewDto {
  @IsString()                period_start!: string;
  @IsString()                period_end!:   string;
  @IsArray()                 assignments!:  any[];
  @IsArray() @IsOptional()   controllers?:  any[];
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('api/schedules')
export class AnalyticsController {
  constructor(
    private readonly client: AnalyticsClient,
    @InjectRepository(Employee)
    private readonly empRepo: Repository<Employee>,
  ) {}

  // ── Cấp ca chi tiết (DetailedRosterModal) ──────────────────────────────

  @Post('review-roster-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async reviewRosterDraft(@Body() dto: ReviewDraftDto) {
    const controllers = await this._controllersFromRows(dto.rows);
    return this.client.reviewRosterDraft({
      team: dto.team, shift_code: dto.shift_code,
      shift_date: dto.shift_date, rows: dto.rows, controllers,
    });
  }

  @Post('roster-checklist')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async getRosterChecklist(@Body() dto: ReviewDraftDto) {
    const controllers = await this._controllersFromRows(dto.rows);
    return this.client.getRosterChecklist({
      team: dto.team, shift_code: dto.shift_code,
      shift_date: dto.shift_date, rows: dto.rows, controllers,
    });
  }

  // ── Cấp tháng (SchedulerScreen) ────────────────────────────────────────

  @Post('review-macro-roster')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async reviewMacro(@Body() dto: MacroReviewDto) {
    const controllers = await this._controllersFromAssignments(dto.assignments);
    return this.client.reviewMacro({
      period_start: dto.period_start,
      period_end:   dto.period_end,
      controllers,
      assignments:  dto.assignments,
    });
  }

  @Post('macro-checklist')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async getMacroChecklist(@Body() dto: MacroReviewDto) {
    const controllers = await this._controllersFromAssignments(dto.assignments);
    return this.client.getMacroChecklist({
      period_start: dto.period_start,
      period_end:   dto.period_end,
      controllers,
      assignments:  dto.assignments,
    });
  }

  // ── SPI Dashboard ─────────────────────────────────────────────────────

  @Get('spi-summary/:monthKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  getSpiSummary(@Param('monthKey') monthKey: string) {
    return this.client.getSpiSummary(monthKey);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async _controllersFromRows(rows: any[]): Promise<any[]> {
    const abbrSet = new Set<string>();
    for (const row of rows ?? []) {
      for (const [key, val] of Object.entries(row)) {
        if (key === 'time') continue;
        if (typeof val === 'string' && val.trim()) {
          val.trim().toUpperCase().split(/[\s,]+/).forEach(t => { if (t) abbrSet.add(t); });
        }
      }
    }
    return this._lookupByAbbr([...abbrSet]);
  }

  private async _controllersFromAssignments(assignments: any[]): Promise<any[]> {
    const idSet = new Set<string>();
    for (const a of assignments ?? []) {
      if (a?.controller_id) idSet.add(String(a.controller_id));
    }
    if (!idSet.size) return [];
    const emps = await this.empRepo.find({
      where: { id: In([...idSet]), isApproved: true },
    });
    return emps.map(e => ({
      id: String(e.id), name: e.name,
      abbr: e.icaoCode ?? '', team: e.team ?? '',
      qualification: e.qualification ?? '',
    }));
  }

  private async _lookupByAbbr(abbrs: string[]): Promise<any[]> {
    if (!abbrs.length) return [];
    const emps = await this.empRepo.find({
      where: { icaoCode: In(abbrs), isApproved: true },
    });
    return emps.map(e => ({
      abbr: e.icaoCode ?? '', id: String(e.id), name: e.name,
      qualification: e.qualification ?? '',
    }));
  }
}
