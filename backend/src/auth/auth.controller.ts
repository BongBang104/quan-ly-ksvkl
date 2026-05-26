import { Controller, Post, Body, HttpCode, HttpStatus, Patch, Param, UseGuards } from '@nestjs/common';
import { AuthService }  from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { id: string; password: string }) {
    return this.auth.login(body.id, body.password);
  }
}

// Đặt endpoint đổi mật khẩu cùng file cho gọn
@Controller('api/employees')
export class PasswordController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Patch(':id/password')
  changePassword(@Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.auth.changePassword(id, body.newPassword);
  }
}
