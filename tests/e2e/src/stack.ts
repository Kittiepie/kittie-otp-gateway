import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, type StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';

/**
 * Starts the whole system for one test file:
 *   Testcontainers: Postgres, Redis, RabbitMQ, Mailpit (throwaway, random host ports)
 *   Processes:      the *built* api and worker (dist/main.js), pointed at those containers
 * Run `pnpm build` (or `pnpm test:e2e`, which does it) first.
 */

const repoRoot = path.resolve(__dirname, '../../..');
const apiDir = path.join(repoRoot, 'apps/api');
const workerDir = path.join(repoRoot, 'apps/worker');

export const ADMIN = { email: 'e2e-admin@otp.local', password: 'e2e-password-123' };

export interface Stack {
  apiUrl: string;
  mailpitUrl: string;
  stop(): Promise<void>;
}

export async function startStack(): Promise<Stack> {
  const [postgres, redis, rabbit, mailpit] = await Promise.all([
    new PostgreSqlContainer('postgres:16').start(),
    new RedisContainer('redis:7').start(),
    new RabbitMQContainer('rabbitmq:3-management').start(),
    new GenericContainer('axllent/mailpit')
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forListeningPorts())
      .start(),
  ]);
  const containers: StartedTestContainer[] = [postgres, redis, rabbit, mailpit];
  const processes: ChildProcess[] = [];
  const stop = async () => {
    processes.forEach((p) => p.kill());
    await Promise.all(containers.map((c) => c.stop()));
  };

  try {
    const env = await buildEnv(postgres, redis, rabbit, mailpit);

    // Same steps as the migration container in Docker: apply migrations, then seed the admin.
    runNode(
      apiDir,
      [path.join(apiDir, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      env,
    );
    runNode(apiDir, [path.join(apiDir, 'node_modules/tsx/dist/cli.mjs'), 'prisma/seed.ts'], env);

    processes.push(startProcess('api', path.join(apiDir, 'dist/main.js'), env));
    processes.push(startProcess('worker', path.join(workerDir, 'dist/main.js'), env));

    const apiUrl = `http://localhost:${env.API_PORT}`;
    await waitForReady(`${apiUrl}/health/ready`);
    await waitForReady(`http://localhost:${env.WORKER_PORT}/health/ready`);

    return {
      apiUrl,
      mailpitUrl: `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`,
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function buildEnv(
  postgres: StartedPostgreSqlContainer,
  redis: StartedRedisContainer,
  rabbit: StartedRabbitMQContainer,
  mailpit: StartedTestContainer,
): Promise<NodeJS.ProcessEnv> {
  return {
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    API_PORT: String(await freePort()),
    WORKER_PORT: String(await freePort()),
    DATABASE_URL: postgres.getConnectionUri(),
    REDIS_URL: redis.getConnectionUrl(),
    RABBITMQ_URL: rabbit.getAmqpUrl(),
    SMTP_HOST: mailpit.getHost(),
    SMTP_PORT: String(mailpit.getMappedPort(1025)),
    SMTP_FROM: 'OTP Gateway <no-reply@otp.local>',
    OTP_HMAC_SECRET: 'e2e-hmac-secret-at-least-16',
    JWT_SECRET: 'e2e-jwt-secret-at-least-16',
    ADMIN_EMAIL: ADMIN.email,
    ADMIN_PASSWORD: ADMIN.password,
  };
}

function runNode(cwd: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`node ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
}

/** cwd is a temp dir so the apps can't pick up the developer's repo-root .env by accident. */
function startProcess(name: string, script: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(process.execPath, [script], { cwd: tmpdir(), env });
  child.stdout?.on(
    'data',
    (chunk: Buffer) => process.env.E2E_VERBOSE && process.stdout.write(`[${name}] ${chunk}`),
  );
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(`[${name}] ${chunk}`));
  return child;
}

async function waitForReady(url: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await fetch(url).then(
      (res) => res.ok,
      () => false,
    );
    if (ok) return;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });
}
