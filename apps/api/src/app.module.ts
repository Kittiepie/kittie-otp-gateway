import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { AdminModule } from './admin/admin.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { Env, validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { MessagingModule } from './messaging/messaging.module';
import { OtpModule } from './otp/otp.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Paths are relative to where the process starts (apps/api). Missing files are ignored,
      // so in containers only real environment variables are used.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          // Reuse the caller's request id if it sent one, so logs can be followed across services.
          genReqId: (req, res) => {
            const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: [
            'req.headers["x-api-key"]',
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
          ],
          autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    MessagingModule,
    ScheduleModule.forRoot(),
    HealthModule,
    OtpModule,
    AdminModule,
  ],
  providers: [
    // Registered here (not in main.ts) so they also apply in tests that build the module.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
