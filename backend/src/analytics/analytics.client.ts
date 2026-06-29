import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class AnalyticsClient {
  private readonly log = new Logger(AnalyticsClient.name);
  private readonly baseUrl: string;

  // Circuit breaker state
  private cbState: CircuitState = 'CLOSED';
  private cbFailures = 0;
  private cbOpenedAt = 0;
  private readonly CB_THRESHOLD = 5;    // failures before opening
  private readonly CB_RESET_MS  = 30_000; // 30s before trying again

  constructor(private readonly cfg: ConfigService) {
    this.baseUrl = cfg.get<string>('ANALYTICS_URL', 'http://localhost:8001');
  }

  private checkCircuit() {
    if (this.cbState === 'OPEN') {
      if (Date.now() - this.cbOpenedAt >= this.CB_RESET_MS) {
        this.cbState = 'HALF_OPEN';
        this.log.warn('Circuit HALF_OPEN — testing analytics service');
      } else {
        throw new ServiceUnavailableException('Dịch vụ phân tích tạm thời không khả dụng (circuit open).');
      }
    }
  }

  private onSuccess() {
    this.cbFailures = 0;
    if (this.cbState !== 'CLOSED') {
      this.log.log('Circuit CLOSED — analytics service recovered');
    }
    this.cbState = 'CLOSED';
  }

  private onFailure(path: string, err: any) {
    this.cbFailures++;
    this.log.error(`Analytics call failed [${path}]: ${err?.message} (failures: ${this.cbFailures})`);
    if (this.cbFailures >= this.CB_THRESHOLD || this.cbState === 'HALF_OPEN') {
      this.cbState = 'OPEN';
      this.cbOpenedAt = Date.now();
      this.log.warn(`Circuit OPEN after ${this.cbFailures} failures`);
    }
  }

  private async _post<T>(path: string, payload: unknown): Promise<T> {
    this.checkCircuit();
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
      const data = await res.json() as T;
      this.onSuccess();
      return data;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.onFailure(path, err);
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
    return this._get(`/analytics/spi/summary?month_key=${encodeURIComponent(monthKey)}`);
  }

  async checkCompliance(payload: unknown): Promise<unknown> {
    return this._post('/analytics/compliance/check', payload);
  }

  async getFairnessSummary(payload: unknown): Promise<unknown> {
    return this._post('/analytics/fairness/summary', payload);
  }

  async getRatingsExpiring(days: number): Promise<unknown> {
    return this._get(`/analytics/ratings/expiring?days=${days}`);
  }

  async getRatingsCoverage(): Promise<unknown> {
    return this._get('/analytics/ratings/coverage');
  }

  async optimizeRoster(payload: unknown): Promise<unknown> {
    return this._post('/analytics/optimize/roster', payload);
  }

  async getMacroFairness(payload: unknown): Promise<unknown> {
    return this._post('/analytics/roster/macro/fairness', payload);
  }

  private async _get<T>(path: string): Promise<T> {
    this.checkCircuit();
    try {
      const res = await fetch(`${this.baseUrl}${path}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Analytics ${path} → ${res.status}: ${text}`);
      }
      const data = await res.json() as T;
      this.onSuccess();
      return data;
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      this.onFailure(path, err);
      throw new ServiceUnavailableException('Dịch vụ phân tích chưa sẵn sàng.');
    }
  }
}
