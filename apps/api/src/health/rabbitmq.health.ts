import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RabbitMqService } from '../messaging/rabbitmq.service';

@Injectable()
export class RabbitMqHealthIndicator {
  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly health: HealthIndicatorService,
  ) {}

  isHealthy(key: string) {
    const indicator = this.health.check(key);
    return this.rabbit.isConnected()
      ? indicator.up()
      : indicator.down({ message: 'Not connected' });
  }
}
