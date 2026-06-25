import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, LessThan, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FatigueReport } from './fatigue-report.entity';

@Injectable()
export class FatigueReportsService {
  private readonly log = new Logger(FatigueReportsService.name);

  constructor(
    @InjectRepository(FatigueReport)
    private readonly repo: Repository<FatigueReport>,
  ) {}

  private async _nextAnonCode(): Promise<string> {
    const year       = new Date().getFullYear();
    const yearPrefix = `FR-${year}-`;
    const last = await this.repo
      .createQueryBuilder('fr')
      .where('fr.anonCode LIKE :p', { p: `${yearPrefix}%` })
      .orderBy('fr.anonCode', 'DESC')
      .limit(1)
      .getOne();
    const nextNum = last ? parseInt(last.anonCode.slice(yearPrefix.length)) + 1 : 1;
    return `${yearPrefix}${String(nextNum).padStart(6, '0')}`;
  }

  async create(data: Partial<FatigueReport>): Promise<FatigueReport> {
    const id       = `fr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const anonCode = await this._nextAnonCode();
    const report   = this.repo.create({ ...data, id, anonCode, status: 'submitted' });
    return this.repo.save(report);
  }

  findMine(reporterId: string): Promise<FatigueReport[]> {
    return this.repo.find({ where: { reporterId }, order: { createdAt: 'DESC' } });
  }

  findForChief(): Promise<FatigueReport[]> {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    return this.repo.find({ where: { createdAt: MoreThan(since) }, order: { createdAt: 'DESC' } });
  }

  async acknowledge(id: string, chiefId: string): Promise<FatigueReport> {
    const r = await this.repo.findOneByOrFail({ id });
    r.acknowledgedBy = chiefId;
    r.acknowledgedAt = new Date();
    if (r.status === 'submitted') r.status = 'acknowledged';
    return this.repo.save(r);
  }

  async findAnonymizedSummary(periodStart: Date, periodEnd: Date) {
    const reports = await this.repo.find({
      where: { createdAt: Between(periodStart, periodEnd) },
      order: { createdAt: 'DESC' },
    });
    return reports.map(r => ({
      anonCode:     r.anonCode,
      facility:     r.facility,
      shiftType:    r.shiftType,
      kssScore:     r.kssScore,
      fatigueOnset: r.fatigueOnset,
      factors: {
        schedule:  r.factorsSchedule  ?? [],
        operation: r.factorsOperation ?? [],
        personal:  r.factorsPersonal  ?? [],
      },
      status:    r.status,
      createdAt: r.createdAt,
      isRedLine: r.isRedLine ?? false,
    }));
  }

  async notifySafetyDept(id: string): Promise<FatigueReport> {
    const r = await this.repo.findOneByOrFail({ id });
    r.safetyNotified   = true;
    r.safetyNotifiedAt = new Date();
    return this.repo.save(r);
  }

  // Escalation: check reports not acknowledged after 24h — QĐ 2289 Chương VI bước 5
  @Cron(CronExpression.EVERY_HOUR)
  async escalatePending(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
    const pending = await this.repo.find({
      where: { status: 'submitted', safetyNotified: false, createdAt: LessThan(cutoff) },
    });
    for (const r of pending) {
      await this.notifySafetyDept(r.id);
    }
    if (pending.length) this.log.log(`Escalated ${pending.length} fatigue report(s) to safety dept.`);
    return pending.length;
  }
}
