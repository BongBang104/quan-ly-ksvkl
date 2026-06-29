import { Controller, Get, Post, Delete, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushService }  from './push.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';

@Controller('api/push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('vapid-public-key')
  getPublicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Req() req: any, @Body() dto: SubscribePushDto) {
    await this.push.subscribe(req.user.id, dto);
    return { ok: true };
  }

  @Delete('subscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Body() body: { endpoint: string }) {
    await this.push.unsubscribe(body.endpoint);
    return { ok: true };
  }
}
