import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.validation';
import { OtpModule } from '../otp/otp.module';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ClientsController } from './clients/clients.controller';
import { ClientsService } from './clients/clients.service';
import { LogsController } from './logs/logs.controller';
import { LogsService } from './logs/logs.service';
import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';
import { TestSendController } from './test-send/test-send.controller';

@Module({
  imports: [
    OtpModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN_SECONDS', { infer: true }) },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    ClientsController,
    LogsController,
    StatsController,
    TestSendController,
  ],
  providers: [AdminAuthService, JwtAuthGuard, ClientsService, LogsService, StatsService],
})
export class AdminModule {}
