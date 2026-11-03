import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { Env } from './config/env.validation';

/** HTTP-level setup shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(cookieParser());
  app.enableCors({ origin: config.get('DASHBOARD_ORIGIN', { infer: true }), credentials: true });
  // Lets Kubernetes stop the pod gracefully: Nest closes Prisma, Redis and RabbitMQ on SIGTERM.
  app.enableShutdownHooks();
}
