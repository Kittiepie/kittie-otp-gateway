import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import type { Env } from './config/env.validation';

/**
 * The worker's real job is the RabbitMQ consumer (OtpConsumer). It still runs as an HTTP app,
 * only so Kubernetes can call /health/live and /health/ready.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('WORKER_PORT', { infer: true }));
}

void bootstrap();
