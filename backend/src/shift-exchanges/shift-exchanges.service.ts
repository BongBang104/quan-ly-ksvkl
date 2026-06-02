import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftExchange } from './shift-exchange.entity';

@Injectable()
export class ShiftExchangesService {
  constructor(
    @InjectRepository(ShiftExchange)
    private readonly repo: Repository<ShiftExchange>,
  ) {}

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
    ex.status              = 'counterparty_agreed';
    ex.counterpartyAgreedAt = new Date();
    return this.repo.save(ex);
  }

  async chiefApprove(id: string, chiefId: string, role: string): Promise<ShiftExchange> {
    const ex = await this.repo.findOneByOrFail({ id });
    if (!ex.chiefApproverId) {
      ex.chiefApproverId  = chiefId;
      ex.chiefApproverRole = role;
      ex.chiefApprovedAt  = new Date();
      // ACC/APP/TWR cần 2 kíp trưởng; TWR_ONLY chỉ cần 1
      if (ex.facilityType === 'ACC_APP_TWR') {
        ex.status = 'chief_1_approved';
      } else {
        ex.status = 'chief_approved';
      }
    } else {
      ex.chiefApproverId2 = chiefId;
      ex.chiefApproved2At = new Date();
      ex.status           = 'chief_approved';
    }
    return this.repo.save(ex);
  }

  async reject(id: string, reason: string): Promise<ShiftExchange> {
    const ex = await this.repo.findOneByOrFail({ id });
    ex.status          = 'rejected';
    ex.rejectionReason = reason;
    return this.repo.save(ex);
  }
}
