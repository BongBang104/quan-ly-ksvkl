import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard }   from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get()
  get() { return this.svc.get(); }

  @Put()
  @UseGuards(JwtAuthGuard)
  save(@Body() body: { config: Record<string, any> }) {
    return this.svc.save(body.config);
  }
}
