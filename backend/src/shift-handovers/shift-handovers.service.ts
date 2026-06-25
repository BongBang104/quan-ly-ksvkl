import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShiftHandover } from './shift-handover.entity';

@Injectable()
export class ShiftHandoversService {
  constructor(
    @InjectRepository(ShiftHandover)
    private readonly repo: Repository<ShiftHandover>,
  ) {}

  async createOrGet(team: string, handoverDate: string, shiftCode: string): Promise<ShiftHandover> {
    const existing = await this.repo.findOneBy({ team, handoverDate, shiftCode });
    if (existing) return existing;
    const id = `hw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const hw = this.repo.create({ id, team, handoverDate, shiftCode, status: 'draft' });
    return this.repo.save(hw);
  }

  async update(id: string, data: Partial<ShiftHandover>): Promise<ShiftHandover> {
    const hw = await this.repo.findOneByOrFail({ id });
    Object.assign(hw, data);
    return this.repo.save(hw);
  }

  async signOutgoing(id: string, signerId: string, signerName: string): Promise<ShiftHandover> {
    const hw = await this.repo.findOneByOrFail({ id });
    hw.outgoingSignerId   = signerId;
    hw.outgoingSignerName = signerName;
    hw.outgoingSignedAt   = new Date();
    hw.status = 'outgoing_signed';
    return this.repo.save(hw);
  }

  async signIncoming(id: string, signerId: string, signerName: string): Promise<ShiftHandover> {
    const hw = await this.repo.findOneByOrFail({ id });
    hw.incomingSignerId   = signerId;
    hw.incomingSignerName = signerName;
    hw.incomingSignedAt   = new Date();
    hw.status = 'both_signed';
    return this.repo.save(hw);
  }

  findByTeamDate(team: string, date: string): Promise<ShiftHandover[]> {
    return this.repo.find({ where: { team, handoverDate: date }, order: { shiftCode: 'ASC' } });
  }
}
