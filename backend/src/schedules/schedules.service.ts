import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Schedule }               from './schedule.entity';
import { Shift }                  from './shift.entity';
import { ShiftPositionSession }   from './shift-position-session.entity';
import { Employee }               from '../employees/employee.entity';
import { Setting }                from '../settings/settings.entity';

const DEFAULT_SHIFT_TYPES = [
  { code: 'S', startTime: '07:00', endTime: '19:00', isNight: false },
  { code: 'D', startTime: '19:00', endTime: '07:00', isNight: true  },
];

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly repo: Repository<Schedule>,
    @InjectRepository(Shift)
    private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftPositionSession)
    private readonly sessionRepo: Repository<ShiftPositionSession>,
    @InjectRepository(Employee)
    private readonly empRepo: Repository<Employee>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
  ) {}

  async findByMonth(monthKey: string): Promise<{ data: Record<string, any> }> {
    const row = await this.repo.findOne({ where: { monthKey } });
    return { data: row?.data ?? {} };
  }

  async saveMonth(monthKey: string, data: Record<string, any>): Promise<{ data: Record<string, any> }> {
    const existing = await this.repo.findOne({ where: { monthKey } });
    if (existing) {
      await this.repo.update(monthKey, { data });
    } else {
      await this.repo.save({ monthKey, data });
    }
    return { data };
  }

  /** Populate shifts table from published schedule data. */
  async populateShifts(monthKey: string, data: Record<string, any>): Promise<void> {
    const scheduleData: Record<string, string> = data.scheduleData ?? {};

    // Load shift type config from settings (fall back to defaults)
    const settingRow = await this.settingRepo.findOne({ where: {} });
    const shiftTypes: { code: string; startTime: string; endTime: string; isNight: boolean }[] =
      settingRow?.config?.shiftTypes ?? DEFAULT_SHIFT_TYPES;

    // Load employees to resolve names
    const employees = await this.empRepo.find();
    const empMap = new Map(employees.map(e => [e.id, e]));

    // Delete existing shifts for this month
    const existing = await this.shiftRepo.find({ where: { monthKey } });
    if (existing.length > 0) {
      await this.shiftRepo.delete(existing.map(s => s.id) as any);
    }

    const shifts: Shift[] = [];
    for (const [key, shiftCode] of Object.entries(scheduleData)) {
      if (!shiftCode || key === 'isPublished') continue;
      // key = "${empId}_${YYYY-MM-DD}"
      const underscoreIdx = key.indexOf('_');
      if (underscoreIdx === -1) continue;
      const empId   = key.substring(0, underscoreIdx);
      const dateStr = key.substring(underscoreIdx + 1);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

      const cfg = shiftTypes.find(t => t.code === shiftCode);
      if (!cfg) continue;

      const emp = empMap.get(empId);
      const name = emp?.name ?? empId;

      const [sh, sm] = cfg.startTime.split(':').map(Number);
      const [eh, em] = cfg.endTime.split(':').map(Number);
      const startDt = new Date(`${dateStr}T${cfg.startTime}:00+07:00`);
      const endDate = cfg.isNight
        ? new Date(new Date(dateStr + 'T00:00:00+07:00').getTime() + 86400000)
        : new Date(dateStr + 'T00:00:00+07:00');
      const endDt = new Date(`${endDate.toISOString().split('T')[0]}T${cfg.endTime}:00+07:00`);

      const id = `${monthKey}|${empId}|${dateStr}|${shiftCode}`;
      const shift = this.shiftRepo.create({
        id, monthKey, controllerId: empId, controllerName: name,
        shiftCode, start: startDt, end: endDt, isNight: cfg.isNight ?? false,
      });
      shifts.push(shift);
    }

    if (shifts.length > 0) {
      await this.shiftRepo.save(shifts);
    }
  }
}
