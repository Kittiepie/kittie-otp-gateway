import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { ExpirySweeper } from './expiry-sweeper.service';
import { IdempotencyService } from './idempotency.service';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';
import { OtpStore } from './otp.store';

@Module({
  controllers: [OtpController],
  providers: [OtpService, OtpStore, IdempotencyService, ApiKeyGuard, ExpirySweeper],
  exports: [OtpService],
})
export class OtpModule {}
