import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('api/health')
export class HealthController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  async check() {
    let dbOk = false;
    try { await this.ds.query('SELECT 1'); dbOk = true; } catch {}
    return { status: 'ok', db: dbOk ? 'ok' : 'error', timestamp: new Date().toISOString() };
  }
}
