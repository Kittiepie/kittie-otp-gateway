import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqHealthIndicator } from './rabbitmq.health';
import { RedisHealthIndicator } from './redis.health';

/**
 * Kubernetes probes.
 * - live: "is the process alive?" Never checks dependencies, or a DB outage would restart every pod.
 * - ready: "can it serve traffic?" Checks DB, Redis and RabbitMQ; failing removes the pod
 *   from the Service until it recovers.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly rabbitHealth: RabbitMqHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.redisHealth.pingCheck('redis'),
      () => this.rabbitHealth.isHealthy('rabbitmq'),
    ]);
  }
}
