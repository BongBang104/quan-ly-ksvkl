import {
  Controller, Post, Body, HttpCode, HttpStatus,
  Patch, Param, UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService }       from './auth.service';
import { JwtAuthGuard }      from './jwt-auth.guard';
import { LoginDto }          from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  login(@Body() body: LoginDto, @Request() req: any) {
    const ip        = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    return this.auth.login(body.id, body.password, ip, userAgent);
  }
}

@Controller('api/employees')
export class PasswordController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Patch(':id/password')
  changePassword(
    @Param('id') id: string,
    @Body() body: ChangePasswordDto,
    @Request() req: any,
  ) {
    const caller = req.user; // { id, role, name } từ JwtStrategy.validate()
    if (caller.id !== id && caller.role !== 'superadmin') {
      throw new ForbiddenException('Bạn chỉ được đổi mật khẩu của chính mình.');
    }
    return this.auth.changePassword(id, body.newPassword, caller.id, caller.name);
  }
}
