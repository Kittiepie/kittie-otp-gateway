import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertOtpTopology } from '@otp/shared';
import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type Options,
  type RecoveringChannelModel,
} from 'amqplib';
import type { Env } from '../config/env.validation';

const CONFIRM_TIMEOUT_MS = 5_000;

/**
 * One RabbitMQ connection and one confirm channel for the api.
 *
 * - `recovery` makes amqplib reconnect with exponential backoff; `setup` runs after every
 *   (re)connect and rebuilds the channel and topology.
 * - `waitForConnect: false` lets the api start even while RabbitMQ is down; /health/ready
 *   reports it and publishing fails fast with 503 until the broker is back.
 * - A confirm channel makes the broker ack each message once it has safely stored it.
 */
@Injectable()
export class RabbitMqService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection?: RecoveringChannelModel;
  private channel: ConfirmChannel | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async onModuleInit() {
    this.connection = await connect(this.config.get('RABBITMQ_URL', { infer: true }), {
      recovery: {
        waitForConnect: false,
        maxDelay: 10_000,
        setup: async (model: ChannelModel) => {
          const channel = await model.createConfirmChannel();
          channel.on('error', (err: Error) => this.logger.error({ err }, 'RabbitMQ channel error'));
          channel.on('close', () => {
            if (this.channel === channel) this.channel = null;
          });
          await assertOtpTopology(channel);
          this.channel = channel;
        },
      },
    });
    this.connection.on('connect', () => this.logger.log('Connected to RabbitMQ'));
    this.connection.on('disconnect', (err: Error) => {
      this.channel = null;
      this.logger.warn(`Disconnected from RabbitMQ: ${err.message}`);
    });
    this.connection.on('reconnect-scheduled', ({ attempt, delay }) =>
      this.logger.warn(`RabbitMQ reconnect attempt ${attempt} in ${delay} ms`),
    );
    // Without an 'error' listener, an EventEmitter error would crash the process.
    this.connection.on('error', (err: Error) => this.logger.error({ err }, 'RabbitMQ error'));
  }

  isConnected(): boolean {
    return this.channel !== null;
  }

  /** Resolves only after the broker confirmed the message; rejects otherwise. */
  async publishJson(
    exchange: string,
    routingKey: string,
    body: unknown,
    options: Options.Publish = {},
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) throw new Error('RabbitMQ is not connected');

    const confirmed = new Promise<void>((resolve, reject) => {
      channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(body)),
        // persistent: written to disk, survives a broker restart (the queue is durable too).
        { persistent: true, contentType: 'application/json', ...options },
        (err: unknown) =>
          err ? reject(new Error(`Broker rejected message: ${String(err)}`)) : resolve(),
      );
    });
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Publish confirm timed out')), CONFIRM_TIMEOUT_MS);
    });
    try {
      await Promise.race([confirmed, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async onApplicationShutdown() {
    await this.connection?.close().catch(() => undefined);
  }
}
