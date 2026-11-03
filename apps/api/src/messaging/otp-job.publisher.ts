import { Injectable, Logger } from '@nestjs/common';
import type { SendOtpJob } from '@otp/shared';

/**
 * Phase 2 stand-in for delivery: logs the code so the flow can be tested with curl.
 * Phase 3 replaces this with a RabbitMQ publisher.
 */
@Injectable()
export class OtpJobPublisher {
  private readonly logger = new Logger(OtpJobPublisher.name);

  async publish(job: SendOtpJob): Promise<void> {
    this.logger.warn(`[dev only] OTP for request ${job.requestId}: ${job.code}`);
  }
}
