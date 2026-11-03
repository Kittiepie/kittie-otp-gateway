import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { Env, validateEnv } from './config/env.validation';
import { OtpConsumer } from './consumer/otp-consumer.service';
import { SendOtpHandler } from './consumer/send-otp.handler';
import { DatabaseService } from './database/database.service';
import { HealthController } from './health/health.controller';
import { CHANNEL_PROVIDERS } from './providers/channel-provider';
import { EmailProvider } from './providers/email.provider';
import { MockSmsProvider } from './providers/mock-sms.provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          autoLogging: false,
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
  controllers: [HealthController],
  providers: [
    DatabaseService,
    EmailProvider,
    MockSmsProvider,
    {
      provide: CHANNEL_PROVIDERS,
      inject: [EmailProvider, MockSmsProvider],
      useFactory: (email: EmailProvider, sms: MockSmsProvider) => [email, sms],
    },
    SendOtpHandler,
    OtpConsumer,
  ],
})
export class AppModule {}
