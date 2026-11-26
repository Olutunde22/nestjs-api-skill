import * as Joi from 'joi';

// LOAD-BEARING: a secret whose absence disables a check must be required wherever real
// traffic flows. Local development may run without it.
const requiredOutsideDev = Joi.string().when('APP_ENV', {
  is: Joi.valid('staging', 'production'),
  then: Joi.string().min(32).required(),
  otherwise: Joi.string().min(8).default('dev-only-secret-change-me'),
});

// CORS and CSRF both compare against serialized origins: scheme://host[:port], no path, no
// trailing slash, no wildcard. A trailing slash silently matches nothing.
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i;
const originList = Joi.string().custom((value: string, helpers) => {
  const bad = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && !ORIGIN.test(origin));
  return bad.length ? helpers.message({ custom: `CORS_ORIGINS has invalid origin(s): ${bad.join(', ')}` }) : value;
});

export const validationSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  APP_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  CORS_ORIGINS: originList.default('http://localhost:3001'),
  // 'loopback', a hop count, or a CIDR list your load balancer sends from. Never plain 'true'
  // on a host reachable without the proxy: clients could then forge X-Forwarded-For.
  TRUST_PROXY: Joi.string().allow('').default('false'),
  RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  RATE_LIMIT_STRICT_MAX: Joi.number().integer().min(1).default(5),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  JWT_ACCESS_SECRET: requiredOutsideDev,
  JWT_REFRESH_SECRET: requiredOutsideDev,
  JWT_ACCESS_TTL: Joi.number().integer().min(60).default(900),
  JWT_REFRESH_TTL: Joi.number().integer().min(3600).default(1209600),

  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  COOKIE_DOMAIN: Joi.string().allow('').optional(),

  API_DOCS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
});
