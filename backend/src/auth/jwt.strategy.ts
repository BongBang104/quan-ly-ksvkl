import { Injectable }        from '@nestjs/common';
import { PassportStrategy }  from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService }     from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const s = cfg.get<string>('JWT_SECRET');
        if (!s || s.length < 32) {
          throw new Error('JWT_SECRET phải được khai báo trong .env và dài ≥ 32 ký tự.');
        }
        return s;
      })(),
    });
  }

  // Payload đã được xác thực bởi passport — chỉ cần return để gắn vào request.user
  validate(payload: { sub: string; role: string; name?: string }) {
    return { id: payload.sub, role: payload.role, name: payload.name };
  }
}
