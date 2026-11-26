import { CookieOptions, Response } from 'express';
import { AppConfig } from '../../config/configuration';

// LOAD-BEARING: one place builds cookie options, so set and clear always agree on path and
// domain. A clear with a different path or domain leaves the session alive.
const baseOptions = (config: Pick<AppConfig, 'cookies'>): CookieOptions => ({
  httpOnly: true,
  secure: config.cookies.secure,
  sameSite: 'lax',
  path: '/',
  domain: config.cookies.domain,
});

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken?: string },
  config: Pick<AppConfig, 'cookies' | 'jwt'>,
): void {
  res.cookie(config.cookies.names.access, tokens.accessToken, {
    ...baseOptions(config),
    maxAge: config.jwt.accessTtl * 1000,
  });
  if (tokens.refreshToken) {
    res.cookie(config.cookies.names.refresh, tokens.refreshToken, {
      ...baseOptions(config),
      maxAge: config.jwt.refreshTtl * 1000,
    });
  }
}

export function clearAuthCookies(res: Response, config: Pick<AppConfig, 'cookies'>): void {
  res.clearCookie(config.cookies.names.access, baseOptions(config));
  res.clearCookie(config.cookies.names.refresh, baseOptions(config));
}
