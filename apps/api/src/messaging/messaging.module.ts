import { Global, Module } from '@nestjs/common';
import { OtpJobPublisher } from './otp-job.publisher';
import { RabbitMqService } from './rabbitmq.service';

@Global()
@Module({
  providers: [RabbitMqService, OtpJobPublisher],
  exports: [RabbitMqService, OtpJobPublisher],
})
export class MessagingModule {}
