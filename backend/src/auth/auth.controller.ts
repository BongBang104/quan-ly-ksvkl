import { Controller, Post, Body, HttpCode, HttpStatus, Patch, Param, UseGuards } from '@nestjs/common';
import { AuthService }       from './auth.service';
import { JwtAuthGuard }      from './jwt-auth.guard';
import { LoginDto }          from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.auth.login(body.id, body.password);
  }
}

// Đặt endpoint đổi mật khẩu cùng file cho gọn
@Controller('api/employees')
export class PasswordController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Patch(':id/password')
  changePassword(@Param('id') id: string, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(id, body.newPassword);
  }
}
