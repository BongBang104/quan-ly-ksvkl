import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { randomUUID } from 'crypto';
import { PushSubscription } from './push-subscription.entity';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey  = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const email      = this.config.get<string>('VAPID_EMAIL', 'mailto:admin@atcpro.local');

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY chưa cấu hình — Web Push bị tắt. ' +
        'Sinh keys bằng: npx web-push generate-vapid-keys',
      );
      return;
    }
    webpush.setVapidDetails(email, publicKey, privateKey);
    this.enabled = true;
    this.logger.log('Web Push (VAPID) đã khởi động.');
  }

  getPublicKey(): string {
    return this.config.get<string>('VAPID_PUBLIC_KEY', '');
  }

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    const existing = await this.repo.findOne({ where: { endpoint: sub.endpoint } });
    if (existing) {
      existing.userId = userId;
      existing.p256dh = sub.keys.p256dh;
      existing.auth   = sub.keys.auth;
      await this.repo.save(existing);
    } else {
      await this.repo.save(
        this.repo.create({
          id:       randomUUID(),
          userId,
          endpoint: sub.endpoint,
          p256dh:   sub.keys.p256dh,
          auth:     sub.keys.auth,
        }),
      );
    }
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.repo.delete({ endpoint });
  }

  async sendToAll(title: string, body: string, url = '/'): Promise<void> {
    if (!this.enabled) return;
    const subs = await this.repo.find();
    await this._dispatch(subs, title, body, url);
  }

  async sendToUsers(userIds: string[], title: string, body: string, url = '/'): Promise<void> {
    if (!this.enabled || !userIds?.length) return;
    const subs = await this.repo.find({ where: { userId: In(userIds) } });
    await this._dispatch(subs, title, body, url);
  }

  private async _dispatch(
    subs: PushSubscription[],
    title: string,
    body: string,
    url: string,
  ): Promise<void> {
    const payload = JSON.stringify({ title, body, url, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' });
    await Promise.allSettled(
      subs.map(s =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          .catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
              this.repo.delete({ endpoint: s.endpoint }).catch(() => {});
            }
          }),
      ),
    );
  }
}
