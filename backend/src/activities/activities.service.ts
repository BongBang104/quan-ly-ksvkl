import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Activity }         from './activity.entity';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(Activity)
    private readonly repo: Repository<Activity>,
  ) {}

  async findAll(): Promise<{ list: Activity[] }> {
    const list = await this.repo.find({ order: { startDate: 'DESC' } });
    return { list };
  }

  async replaceAll(list: any[]): Promise<{ list: Activity[] }> {
    await this.repo.clear();
    const entities = list.map(a => this.mapToEntity(a));
    const saved = await this.repo.save(entities);
    return { list: saved };
  }

  async upsertOne(raw: any): Promise<Activity> {
    return this.repo.save(this.mapToEntity(raw));
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private mapToEntity(raw: any): Partial<Activity> {
    return {
      id:         raw.id,
      empId:      raw.empId ?? raw.employeeId,
      type:       raw.type,
      note:       raw.note,
      startDate:  raw.startDate,
      endDate:    raw.endDate,
      approvedBy: raw.approvedBy,
      status:     raw.status ?? 'pending',
    };
  }
}
