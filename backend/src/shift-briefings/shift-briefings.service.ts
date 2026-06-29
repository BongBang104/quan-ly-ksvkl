import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ShiftBriefing } from './shift-briefing.entity';
import { sanitize } from '../common/sanitize.util';

@Injectable()
export class ShiftBriefingsService {
  constructor(
    @InjectRepository(ShiftBriefing)
    private readonly repo: Repository<ShiftBriefing>,
  ) {}

  async create(data: Partial<ShiftBriefing>): Promise<ShiftBriefing> {
    const id = `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const br = this.repo.create({
      ...data,
      id,
      briefingContent:  sanitize(data.briefingContent),
      recommendations:  sanitize(data.recommendations),
    });
    return this.repo.save(br);
  }

  findRecent(days = 30): Promise<ShiftBriefing[]> {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    return this.repo.find({ where: { createdAt: MoreThan(since) }, order: { createdAt: 'DESC' } });
  }

  async update(id: string, data: Partial<ShiftBriefing>): Promise<ShiftBriefing> {
    const br = await this.repo.findOneByOrFail({ id });
    Object.assign(br, {
      ...data,
      briefingContent: data.briefingContent !== undefined ? sanitize(data.briefingContent) : br.briefingContent,
      recommendations: data.recommendations  !== undefined ? sanitize(data.recommendations)  : br.recommendations,
    });
    return this.repo.save(br);
  }

  findOne(id: string): Promise<ShiftBriefing | null> {
    return this.repo.findOneBy({ id });
  }
}
