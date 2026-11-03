import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** HTTP port, only used for the health probes. */
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  /** How many unacknowledged jobs RabbitMQ may hand this worker at once. */
  WORKER_PREFETCH: z.coerce.number().int().positive().default(10),
  /** Make every send fail, to watch retries and the DLQ in action. */
  WORKER_SIMULATE_FAILURE: booleanString,

  DATABASE_URL: z.url(),
  RABBITMQ_URL: z.url(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(3),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
