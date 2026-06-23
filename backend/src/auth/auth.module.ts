import { Module }       from '@nestjs/common';
import { JwtModule }    from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController, PasswordController } from './auth.controller';
import { AuthService }    from './auth.service';
import { JwtStrategy }    from './jwt.strategy';
import { Employee }       from '../employees/employee.entity';
import { AuditModule }    from '../audit/audit.module';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([Employee]),
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: (() => {
          const s = cfg.get<string>('JWT_SECRET');
          if (!s || s.length < 32) {
            throw new Error('JWT_SECRET phải được khai báo trong .env và dài ≥ 32 ký tự.');
          }
          return s;
        })(),
        signOptions: { expiresIn: cfg.get<string>('JWT_EXPIRES_IN', '8h') },
      }),
    }),
  ],
  controllers: [AuthController, PasswordController],
  providers:   [AuthService, JwtStrategy],
  exports:     [JwtModule],
})
export class AuthModule {}
