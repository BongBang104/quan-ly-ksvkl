import {
  Body, Controller, Get, Param, Post, Query,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IsString, IsArray, IsOptional } from 'class-validator';
import { JwtAuthGuard }  from '../auth/jwt-auth.guard';
import { RolesGuard }    from '../auth/roles.guard';
import { Roles }         from '../auth/roles.decorator';
import { Employee }      from '../employees/employee.entity';
import { Schedule }      from '../schedules/schedule.entity';
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
    @InjectRepository(Schedule)
    private readonly schRepo: Repository<Schedule>,
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

  // ── Cấp tháng: Compliance + Fairness từ scheduleData (C3 fix) ────────────

  @Get('macro-compliance/:monthKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async getMacroCompliance(@Param('monthKey') monthKey: string) {
    const { periodStart, periodEnd, assignments } = await this._loadMacroAssignments(monthKey);
    if (!assignments.length) {
      return { violation_count: 0, violations: [], note: 'Chưa có dữ liệu phân ca cho tháng này.' };
    }
    const controllers = await this._controllersFromAssignments(assignments);
    return this.client.reviewMacro({ period_start: periodStart, period_end: periodEnd, controllers, assignments });
  }

  @Get('macro-fairness/:monthKey')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async getMacroFairness(@Param('monthKey') monthKey: string) {
    const { periodStart, periodEnd, assignments } = await this._loadMacroAssignments(monthKey);
    if (!assignments.length) {
      return { controllers: [], note: 'Chưa có dữ liệu phân ca cho tháng này.' };
    }
    const controllers = await this._controllersFromAssignments(assignments);
    return this.client.getMacroFairness({ period_start: periodStart, period_end: periodEnd, controllers, assignments });
  }

  // ── Compliance / Fairness / Ratings / Optimizer proxy (C1 fix) ───────────

  @Post('compliance-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async checkCompliance(@Body() dto: { month_key?: string; include_report?: boolean }) {
    return this.client.checkCompliance(dto);
  }

  @Post('fairness-summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async getFairnessSummary(@Body() dto: { month_key?: string }) {
    return this.client.getFairnessSummary(dto);
  }

  @Get('ratings-expiring')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async getRatingsExpiring(@Query('days') days?: string) {
    const d = days ? parseInt(days, 10) : 60;
    return this.client.getRatingsExpiring(isNaN(d) ? 60 : d);
  }

  @Get('ratings-coverage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async getRatingsCoverage() {
    return this.client.getRatingsCoverage();
  }

  @Post('optimize-roster')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'superadmin', 'CHIEF')
  async optimizeRoster(@Body() dto: any) {
    return this.client.optimizeRoster(dto);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async _loadMacroAssignments(monthKey: string): Promise<{
    periodStart: string; periodEnd: string; assignments: any[];
  }> {
    const schedule = await this.schRepo.findOne({ where: { monthKey } });
    if (!schedule) return { periodStart: `${monthKey}-01`, periodEnd: `${monthKey}-01`, assignments: [] };

    const data = schedule.data || {};
    const scheduleData = data.scheduleData || {};
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const lastDay = new Date(year, month, 0).getDate();
    const periodStart = `${yearStr}-${monthStr}-01`;
    const periodEnd   = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const assignments: any[] = [];
    for (const [key, shiftKind] of Object.entries(scheduleData)) {
      if (key === 'isPublished') continue;
      if (!key.includes('_')) continue;
      const sepIdx = key.lastIndexOf('_');
      const empId  = key.slice(0, sepIdx);
      const rawDate = key.slice(sepIdx + 1);
      if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDate)) continue;
      const [y, m, d] = rawDate.split('-');
      const isoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      assignments.push({ controller_id: empId, date: isoDate, shift_kind: String(shiftKind || 'OFF').toUpperCase() });
    }
    return { periodStart, periodEnd, assignments };
  }

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
