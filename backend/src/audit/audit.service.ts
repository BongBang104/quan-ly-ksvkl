import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export type AuditAction =
  | 'LOGIN_SUCCESS' | 'LOGIN_FAIL'
  | 'CHANGE_PASSWORD' | 'RESET_PASSWORD'
  | 'CREATE_EMPLOYEE' | 'UPDATE_EMPLOYEE' | 'DELETE_EMPLOYEE'
  | 'APPROVE_EMPLOYEE' | 'REJECT_EMPLOYEE'
  | 'CHANGE_ROLE';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(entry: {
    actorId?:      string;
    actorName?:    string;
    action:        AuditAction;
    resourceType?: string;
    resourceId?:   string;
    payload?:      object;
    ip?:           string;
    userAgent?:    string;
  }) {
    await this.repo.save(this.repo.create(entry));
  }

  async findAll(limit = 200): Promise<AuditLog[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async purgeOldLogs() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    await this.repo.delete({ createdAt: LessThan(cutoff) });
  }
}
