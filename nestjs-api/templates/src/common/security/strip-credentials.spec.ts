import { isSensitiveKey, stripCredentials } from './strip-credentials';

class UserEntity {
  id = 'u-1';
  email = 'ada@example.com';
  passwordHash = '$2b$12$abc';
  otpSecret = 'JBSWY3DPEHPK3PXP';
}

describe('stripCredentials', () => {
  it('removes credentials at any depth, through arrays and entities', () => {
    const result = stripCredentials({
      user: new UserEntity(),
      sessions: [{ id: 's-1', refresh_token: 'r', createdAt: new Date('2026-01-31T10:00:00Z') }],
      payment: { last4: '4242', cardNumber: '4242424242424242', cvv: '123' },
      apiKey: 'sk_live_x',
    });

    expect(result).toEqual({
      user: { id: 'u-1', email: 'ada@example.com' },
      sessions: [{ id: 's-1', createdAt: new Date('2026-01-31T10:00:00Z') }],
      payment: { last4: '4242' },
    });
  });

  it('keeps only the fields a route explicitly exposes', () => {
    const result = stripCredentials(
      { accessToken: 'a', refreshToken: 'r', password: 'p' },
      ['accessToken'],
    );
    expect(result).toEqual({ accessToken: 'a' });
  });

  it('matches regardless of casing and separators', () => {
    for (const key of ['password', 'PASSWORD', 'password_hash', 'new-password', 'mfaSecret', 'webhook_secret', 'resetToken', 'otp', 'pin']) {
      expect(isSensitiveKey(key)).toBe(true);
    }
    for (const key of ['id', 'name', 'tokenCount', 'pinned', 'spinner', 'passwordUpdatedAt', 'status']) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });

  it('survives cycles and leaves primitives alone', () => {
    const node: Record<string, unknown> = { id: 'n-1', secret: 's' };
    node.self = node;
    expect(stripCredentials(node)).toEqual({ id: 'n-1', self: undefined });
    expect(stripCredentials('plain')).toBe('plain');
    expect(stripCredentials(null)).toBeNull();
  });
});
