import { Injectable } from '@nestjs/common';
import { OTP_EXCHANGE, ROUTING_KEYS, type SendOtpJob } from '@otp/shared';
import { RabbitMqService } from './rabbitmq.service';

/** Puts a delivery job on the `otp` exchange; the worker picks it up from `otp.send`. */
@Injectable()
export class OtpJobPublisher {
  constructor(private readonly rabbit: RabbitMqService) {}

  publish(job: SendOtpJob): Promise<void> {
    return this.rabbit.publishJson(OTP_EXCHANGE, ROUTING_KEYS.send, job, {
      messageId: `${job.requestId}:${job.attempt}`,
    });
  }
}
