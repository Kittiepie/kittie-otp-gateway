import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { OtpConsumer } from '../consumer/otp-consumer.service';
import { DatabaseService } from '../database/database.service';

/** Kubernetes probes for the worker (same meaning as in the api). */
@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly consumer: OtpConsumer,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const database = await this.db.ping().then(
      () => 'up',
      () => 'down',
    );
    const rabbitmq = this.consumer.isConnected() ? 'up' : 'down';
    const checks = { database, rabbitmq };
    if (database !== 'up' || rabbitmq !== 'up') {
      throw new ServiceUnavailableException({ message: 'Not ready', checks });
    }
    return { status: 'ok', checks };
  }
}
