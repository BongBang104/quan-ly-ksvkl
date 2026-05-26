import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { Setting }          from './settings.entity';

const DEFAULT_CONFIG = {
  teams: ['Kíp A', 'Kíp B', 'Kíp C', 'Kíp D', 'Hành chính'],
  shiftTypes: [
    { code: 'S', label: 'Sáng', startTime: '07:00', endTime: '19:00' },
    { code: 'D', label: 'Đêm',  startTime: '19:00', endTime: '07:00' },
  ],
  activityTypes: [
    { id: 'LEAVE', code: 'P',  label: 'Nghỉ phép' },
    { id: 'SICK',  code: 'O',  label: 'Nghỉ ốm'  },
    { id: 'TRIP',  code: 'CT', label: 'Công tác'  },
    { id: 'STUDY', code: 'H',  label: 'Đi học'   },
  ],
  qualifications: ['Full', 'TWR', 'APP', 'TWR/APP', 'GND', 'Học viên'],
  apiBaseUrl: 'http://localhost:3000',
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  async get(): Promise<{ config: Record<string, any> }> {
    let row = await this.repo.findOne({ where: {} });
    if (!row) {
      row = await this.repo.save({ config: DEFAULT_CONFIG });
    }
    return { config: row.config };
  }

  async save(config: Record<string, any>): Promise<{ config: Record<string, any> }> {
    let row = await this.repo.findOne({ where: {} });
    if (row) {
      await this.repo.update(row.id, { config });
    } else {
      await this.repo.save({ config });
    }
    return { config };
  }
}
