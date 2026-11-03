import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);
const positiveInt = z.coerce.number().int().positive();

/**
 * Every environment variable the api reads. The app refuses to start if one is missing or
 * malformed, so a bad deploy fails at boot instead of on the first request.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_PORT: port.default(3000),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  RABBITMQ_URL: z.url(),

  OTP_HMAC_SECRET: z.string().min(16),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN_SECONDS: positiveInt.default(8 * 60 * 60),

  OTP_TTL_SECONDS: positiveInt.default(300),
  OTP_MAX_ATTEMPTS: positiveInt.default(5),
  RATE_LIMIT_RECIPIENT_MAX: positiveInt.default(3),
  RATE_LIMIT_RECIPIENT_WINDOW_SECONDS: positiveInt.default(600),
  IDEMPOTENCY_TTL_SECONDS: positiveInt.default(24 * 60 * 60),

  DASHBOARD_ORIGIN: z.url().default('http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
