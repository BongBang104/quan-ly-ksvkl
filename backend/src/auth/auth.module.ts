import { Module }       from '@nestjs/common';
import { JwtModule }    from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController, PasswordController } from './auth.controller';
import { AuthService }    from './auth.service';
import { JwtStrategy }    from './jwt.strategy';
import { Employee }       from '../employees/employee.entity';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([Employee]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'atc_secret_key'),
        signOptions: { expiresIn: cfg.get<string>('JWT_EXPIRES_IN', '8h') },
      }),
    }),
  ],
  controllers: [AuthController, PasswordController],
  providers:   [AuthService, JwtStrategy],
  exports:     [JwtModule],
})
export class AuthModule {}
