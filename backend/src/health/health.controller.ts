import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly cfg: ConfigService,
  ) {}

  @Get()
  async check() {
    let dbOk = false;
    try { await this.ds.query('SELECT 1'); dbOk = true; } catch {}
    return { status: 'ok', db: dbOk ? 'ok' : 'error', timestamp: new Date().toISOString() };
  }

  @Get('detailed')
  @UseGuards(JwtAuthGuard)
  async detailed() {
    const checks: Record<string, any> = {
      db:        false,
      analytics: false,
      timestamp: new Date().toISOString(),
      uptime:    process.uptime(),
      memory:    process.memoryUsage(),
      nodeVersion: process.version,
    };

    try { await this.ds.query('SELECT 1'); checks.db = true; } catch {}

    const analyticsUrl = this.cfg.get<string>('ANALYTICS_URL', 'http://localhost:8001');
    try {
      const res = await fetch(`${analyticsUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      checks.analytics = res.ok;
    } catch {}

    const allOk = checks.db && checks.analytics;
    return { status: allOk ? 'ok' : 'degraded', ...checks };
  }
}
