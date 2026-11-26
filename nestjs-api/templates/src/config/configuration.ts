export interface AppConfig {
  port: number;
  nodeEnv: string;
  appEnv: 'development' | 'test' | 'staging' | 'production';
  corsOrigins: string[];
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  cookies: {
    secure: boolean;
    domain?: string;
    names: { access: string; refresh: string };
  };
  docs: { enabled: boolean };
  security: {
    trustProxy: string | number | boolean;
    rateLimit: { ttlMs: number; limit: number; strictLimit: number };
  };
}

const parseTrustProxy = (value: string | undefined): string | number | boolean => {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  const hops = Number(value);
  return Number.isInteger(hops) ? hops : value;
};

const COOKIE_PREFIX: Record<AppConfig['appEnv'], string> = {
  development: 'dv',
  test: 'ts',
  staging: 'st',
  production: 'pr',
};

const appEnv = (): AppConfig['appEnv'] =>
  (process.env.APP_ENV as AppConfig['appEnv'] | undefined) ?? 'development';

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appEnv: appEnv(),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '1209600', 10),
  },
  cookies: {
    secure: process.env.COOKIE_SECURE === 'true',
    domain: process.env.COOKIE_DOMAIN || undefined,
    // LOAD-BEARING when environments share a parent domain: per-environment names stop a
    // staging login from overwriting a production session cookie.
    names: {
      access: `${COOKIE_PREFIX[appEnv()]}_ac_tk`,
      refresh: `${COOKIE_PREFIX[appEnv()]}_re_tk`,
    },
  },
  docs: { enabled: process.env.API_DOCS_ENABLED !== 'false' },
  security: {
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    rateLimit: {
      ttlMs: parseInt(process.env.RATE_LIMIT_TTL_MS ?? '60000', 10),
      limit: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
      strictLimit: parseInt(process.env.RATE_LIMIT_STRICT_MAX ?? '5', 10),
    },
  },
});
