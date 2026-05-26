import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Request }          from './request.entity';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly repo: Repository<Request>,
  ) {}

  async findAll(): Promise<{ list: any[] }> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return { list: rows.map(r => this.toFrontend(r)) };
  }

  async replaceAll(list: any[]): Promise<{ list: any[] }> {
    await this.repo.clear();
    const saved = await this.repo.save(list.map(r => this.toEntity(r)));
    return { list: saved.map(r => this.toFrontend(r)) };
  }

  async upsertOne(raw: any): Promise<any> {
    const saved = await this.repo.save(this.toEntity(raw));
    return this.toFrontend(saved);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toEntity(raw: any): Partial<Request> {
    const { id, type, status, startDate, endDate, note, reviewedBy, reviewNote,
            employeeId, requesterId, date, reason, ...rest } = raw;
    return {
      id:         id,
      employeeId: employeeId ?? requesterId,
      type:       type,
      note:       note ?? reason,
      startDate:  startDate ?? date,
      endDate:    endDate ?? date,
      status:     status ?? 'pending',
      reviewedBy, reviewNote,
      extraData:  rest,
    };
  }

  private toFrontend(row: Request): any {
    const extra = row.extraData ?? {};
    return {
      id:            row.id,
      employeeId:    row.employeeId,
      requesterId:   extra.requesterId ?? row.employeeId,
      requesterName: extra.requesterName,
      requesterTeam: extra.requesterTeam,
      type:          row.type,
      date:          row.startDate,
      startDate:     row.startDate,
      endDate:       row.endDate,
      note:          row.note,
      reason:        row.note,
      status:        row.status,
      reviewedBy:    row.reviewedBy,
      reviewNote:    row.reviewNote,
      createdAt:     row.createdAt,
      ...extra,
    };
  }
}
