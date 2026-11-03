import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ADMIN_COOKIE } from './admin/auth/admin-session';
import type { Env } from './config/env.validation';

/** HTTP-level setup shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(cookieParser());
  // Only the dashboard's origin may call the api from a browser, with cookies.
  app.enableCors({ origin: config.get('DASHBOARD_ORIGIN', { infer: true }), credentials: true });
  // Lets Kubernetes stop the pod gracefully: Nest closes Prisma, Redis and RabbitMQ on SIGTERM.
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('OTP Gateway')
      .setDescription(
        'Public API (`/v1/otp/*`, header `x-api-key`) and admin API (`/admin/*`, JWT cookie or Bearer).',
      )
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'api-key')
      .addCookieAuth(ADMIN_COOKIE)
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
