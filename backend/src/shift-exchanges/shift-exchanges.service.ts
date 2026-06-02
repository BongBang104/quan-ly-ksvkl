import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository }   from 'typeorm';
import { ShiftExchange }    from './shift-exchange.entity';
import { Employee }         from '../employees/employee.entity';
import { Schedule }         from '../schedules/schedule.entity';
import { AnalyticsClient }  from '../analytics/analytics.client';

@Injectable()
export class ShiftExchangesService {
  constructor(
    @InjectRepository(ShiftExchange) private readonly repo: Repository<ShiftExchange>,
    @InjectRepository(Employee)      private readonly empRepo: Repository<Employee>,
    @InjectRepository(Schedule)      private readonly schRepo: Repository<Schedule>,
    private readonly analytics: AnalyticsClient,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(data: Partial<ShiftExchange>): Promise<ShiftExchange> {
    const id = `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ex = this.repo.create({ ...data, id, status: 'pending' });
    return this.repo.save(ex);
  }

  findPending(userId: string): Promise<ShiftExchange[]> {
    return this.repo.find({
      where: [{ applicantId: userId }, { counterpartyId: userId }],
      order: { createdAt: 'DESC' },
    });
  }

  async counterpartyAgree(id: string, userId: string): Promise<ShiftExchange> {
    const ex = await this.repo.findOneByOrFail({ id });
    if (ex.counterpartyId !== userId) throw new NotFoundException('Không có quyền xác nhận.');
    ex.status               = 'counterparty_agreed';
    ex.counterpartyAgreedAt = new Date();
    return this.repo.save(ex);
  }

  async chiefApprove(
    id: string, chiefId: string, role: string, overrideReason?: string,
  ): Promise<ShiftExchange> {
    const ex = await this.repo.findOneByOrFail({ id });

    // Nếu precheck có warnings/!can_approve → bắt buộc ghi override_reason
    const pc          = ex.precheckResult || {};
    const hasWarnings = (pc.warnings ?? []).length > 0;
    const cantApprove = pc.can_approve === false;
    if ((hasWarnings || cantApprove) && !overrideReason) {
      throw new BadRequestException(
        'Precheck có cảnh báo/vi phạm — kíp trưởng phải ghi rõ lý do phê duyệt (override_reason).',
      );
    }

    if (!ex.chiefApproverId) {
      ex.chiefApproverId   = chiefId;
      ex.chiefApproverRole = role;
      ex.chiefApprovedAt   = new Date();
      if (overrideReason) {
        ex.extraData = { ...(ex.extraData ?? {}), precheck_override_reason: overrideReason };
      }
      ex.status = ex.facilityType === 'ACC_APP_TWR' ? 'chief_1_approved' : 'chief_approved';
    } else {
      ex.chiefApproverId2 = chiefId;
      ex.chiefApproved2At = new Date();
      if (overrideReason) {
        ex.extraData = { ...(ex.extraData ?? {}), precheck_override_reason_2: overrideReason };
      }
      ex.status = 'chief_approved';
    }
    return this.repo.save(ex);
  }

  async reject(id: string, reason: string): Promise<ShiftExchange> {
    const ex = await this.repo.findOneByOrFail({ id });
    ex.status          = 'rejected';
    ex.rejectionReason = reason;
    return this.repo.save(ex);
  }

  // ── Precheck ──────────────────────────────────────────────────────────────

  async runPrecheck(dto: {
    type:                 'EXCHANGE' | 'COVER';
    applicantId:          string;
    counterpartyId:       string;
    applicantShiftDate:   string;
    applicantShiftCode:   string;
    counterpartyShiftDate?: string;
    counterpartyShiftCode?: string;
  }): Promise<any> {
    const [appl, cp] = await Promise.all([
      this.empRepo.findOneByOrFail({ id: dto.applicantId }),
      this.empRepo.findOneByOrFail({ id: dto.counterpartyId }),
    ]);

    // Lấy lịch ±30 ngày quanh ngày đổi
    const monthKeys      = this._monthKeysAround(new Date(dto.applicantShiftDate), 30);
    const schedules      = await this.schRepo.find({ where: { monthKey: In(monthKeys) } });
    const applicantShifts    = this._extractShifts(schedules, dto.applicantId);
    const counterpartyShifts = this._extractShifts(schedules, dto.counterpartyId);

    return this.analytics.precheckExchange({
      type:         dto.type,
      applicant:    { id: appl.id, name: appl.name, qualification: appl.qualification ?? '' },
      counterparty: { id: cp.id,   name: cp.name,   qualification: cp.qualification  ?? '' },
      applicant_shift:    { date: dto.applicantShiftDate,   code: dto.applicantShiftCode },
      counterparty_shift: dto.counterpartyShiftDate
        ? { date: dto.counterpartyShiftDate, code: dto.counterpartyShiftCode ?? 'S' }
        : null,
      applicant_current_shifts:    applicantShifts,
      counterparty_current_shifts: counterpartyShifts,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _monthKeysAround(d: Date, daysAround: number): string[] {
    const keys = new Set<string>();
    for (const delta of [-daysAround, 0, daysAround]) {
      const t = new Date(d);
      t.setDate(t.getDate() + delta);
      keys.add(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
    }
    return [...keys];
  }

  private _extractShifts(schedules: Schedule[], empId: string): any[] {
    // scheduleData: { "<empId>_YYYY-MM-DD": "S"|"D"|"" }
    const out: any[] = [];
    for (const sch of schedules) {
      const sd = sch.data?.scheduleData ?? {};
      for (const [key, code] of Object.entries(sd)) {
        if (!key.startsWith(empId + '_')) continue;
        if (!code || code === 'OFF' || code === 'LEAVE' || code === '') continue;
        const datePart = key.slice(empId.length + 1);   // "2026-06-15"
        const [y, m, d] = datePart.split('-');
        const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        out.push({ date: isoDate, code: String(code) });
      }
    }
    return out;
  }
}
