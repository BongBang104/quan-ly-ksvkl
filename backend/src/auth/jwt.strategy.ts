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
      secretOrKey: cfg.get<string>('JWT_SECRET', 'atc_secret_key'),
    });
  }

  // Payload đã được xác thực bởi passport — chỉ cần return để gắn vào request.user
  validate(payload: { sub: string; role: string }) {
    return { id: payload.sub, role: payload.role };
  }
}
