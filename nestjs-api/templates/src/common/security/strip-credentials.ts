// Keys are compared after lower-casing and removing '_' and '-', so passwordHash,
// password_hash and PASSWORD-HASH all match.
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'passwordconfirmation',
  'currentpassword',
  'newpassword',
  'salt',
  'otp',
  'otpcode',
  'otpsecret',
  'totpsecret',
  'mfasecret',
  'recoverycodes',
  'backupcodes',
  'pin',
  'cvv',
  'cvc',
  'cardnumber',
  'pan',
  'secret',
  'clientsecret',
  'webhooksecret',
  'signingsecret',
  'apikey',
  'privatekey',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'sessiontoken',
  'resettoken',
  'verificationtoken',
  'invitetoken',
  'authorization',
  'cookie',
]);

const SENSITIVE_SUFFIXES = ['password', 'passwordhash', 'secret', 'token', 'apikey', 'privatekey', 'otp'];

export const normalizeKey = (key: string): string => key.toLowerCase().replace(/[-_]/g, '');

export const isSensitiveKey = (key: string): boolean => {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    SENSITIVE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
};

const isPlainLeaf = (value: unknown): boolean =>
  value === null ||
  typeof value !== 'object' ||
  value instanceof Date ||
  Buffer.isBuffer(value) ||
  ArrayBuffer.isView(value);

/**
 * Returns a copy of `value` with every sensitive key removed, at any depth, through arrays,
 * plain objects and class instances (entities). `allow` lists keys a route has deliberately
 * opted to return (compared normalized). Cycles are cut rather than followed.
 */
export function stripCredentials<T>(value: T, allow: readonly string[] = []): T {
  const allowed = new Set(allow.map(normalizeKey));
  const seen = new WeakSet<object>();

  const walk = (node: unknown): unknown => {
    if (isPlainLeaf(node)) return node;
    const obj = node as object;
    if (seen.has(obj)) return undefined;
    seen.add(obj);

    if (Array.isArray(obj)) return obj.map(walk);
    if (obj instanceof Map || obj instanceof Set) return obj;

    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      if (isSensitiveKey(key) && !allowed.has(normalizeKey(key))) continue;
      out[key] = walk(child);
    }
    return out;
  };

  return walk(value) as T;
}
