import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { PermissionKey } from '../../common/permissions';
import { AuthenticatedUser } from '../../common/types';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  permissions: PermissionKey[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppConfig, true>) {
    const accessCookie = config.get('cookies', { infer: true }).names.access;
    super({
      // Cookie for browsers first, then bearer for server-side callers and mobile.
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.[accessCookie] as string | undefined) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).accessSecret,
    });
  }

  // LOAD-BEARING in a real project: reload the user here (or check a token version) so a
  // deactivated account or a revoked permission stops working before the token expires.
  // This template trusts the claims to stay self-contained.
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return { id: payload.sub, username: payload.username, permissions: payload.permissions };
  }
}
