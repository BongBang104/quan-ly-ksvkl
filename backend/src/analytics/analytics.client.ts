import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnalyticsClient {
  private readonly log = new Logger(AnalyticsClient.name);
  private readonly baseUrl: string;

  constructor(private readonly cfg: ConfigService) {
    this.baseUrl = cfg.get<string>('ANALYTICS_URL', 'http://localhost:8001');
  }

  private async _post<T>(path: string, payload: unknown): Promise<T> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Analytics ${path} → ${res.status}: ${text}`);
      }
      return res.json() as Promise<T>;
    } catch (err: any) {
      this.log.error(`Analytics call failed [${path}]: ${err?.message}`);
      throw new ServiceUnavailableException('Dịch vụ phân tích chưa sẵn sàng.');
    }
  }

  async reviewRosterDraft(payload: unknown): Promise<unknown> {
    return this._post('/analytics/roster/review-draft', payload);
  }

  async reviewMacro(payload: unknown): Promise<unknown> {
    return this._post('/analytics/roster/macro/review', payload);
  }

  async getRosterChecklist(payload: unknown): Promise<unknown> {
    return this._post('/analytics/roster/checklist', payload);
  }

  async getMacroChecklist(payload: unknown): Promise<unknown> {
    return this._post('/analytics/roster/macro/checklist', payload);
  }

  async precheckExchange(payload: unknown): Promise<unknown> {
    return this._post('/analytics/exchange/precheck', payload);
  }

  async getSpiSummary(monthKey: string): Promise<unknown> {
    try {
      const res = await fetch(
        `${this.baseUrl}/analytics/spi/summary?month_key=${encodeURIComponent(monthKey)}`,
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    } catch (err: any) {
      this.log.error(`SPI summary failed: ${err?.message}`);
      throw new ServiceUnavailableException('Dịch vụ phân tích chưa sẵn sàng.');
    }
  }
}
