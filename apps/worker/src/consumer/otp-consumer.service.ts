import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  assertOtpTopology,
  isSendOtpJob,
  OTP_EXCHANGE,
  QUEUES,
  ROUTING_KEYS,
  type SendOtpJob,
} from '@otp/shared';
import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
  type Options,
  type RecoveringChannelModel,
} from 'amqplib';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Env } from '../config/env.validation';
import { SendOtpHandler } from './send-otp.handler';

/** Pause before putting a job back after an infrastructure error, to avoid a hot loop. */
const REQUEUE_DELAY_MS = 2_000;

/**
 * Plain amqplib consumer (no @nestjs/microservices), so every RabbitMQ step is visible:
 *
 * 1. prefetch(N): the broker sends at most N unacknowledged messages to this worker.
 * 2. noAck: false: a message stays "unacked" until we ack it. If the worker dies first,
 *    RabbitMQ re-delivers it to another consumer (NFR-06).
 * 3. On a failed send we publish a copy to the retry queue (or DLQ) and wait for the broker's
 *    confirm *before* acking the original. Acking first could lose the job if we crashed in
 *    between; the price is a possible duplicate, which the handler's status check absorbs.
 */
@Injectable()
export class OtpConsumer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OtpConsumer.name);
  private connection?: RecoveringChannelModel;
  private channel: ConfirmChannel | null = null;

  constructor(
    private readonly handler: SendOtpHandler,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit() {
    const prefetch = this.config.get('WORKER_PREFETCH', { infer: true });
    this.connection = await connect(this.config.get('RABBITMQ_URL', { infer: true }), {
      recovery: {
        waitForConnect: false,
        maxDelay: 10_000,
        // Runs after every (re)connect: a new connection needs a new channel and consumer.
        setup: async (model: ChannelModel) => {
          const channel = await model.createConfirmChannel();
          channel.on('error', (err: Error) => this.logger.error({ err }, 'RabbitMQ channel error'));
          channel.on('close', () => {
            if (this.channel === channel) this.channel = null;
          });
          await assertOtpTopology(channel);
          await channel.prefetch(prefetch);
          await channel.consume(
            QUEUES.send,
            (msg) => {
              if (msg) void this.onMessage(channel, msg);
            },
            { noAck: false },
          );
          this.channel = channel;
          this.logger.log(`Consuming ${QUEUES.send} (prefetch ${prefetch})`);
        },
      },
    });
    this.connection.on('disconnect', (err: Error) => {
      this.channel = null;
      this.logger.warn(`Disconnected from RabbitMQ: ${err.message}`);
    });
    this.connection.on('reconnect-scheduled', ({ attempt, delay }) =>
      this.logger.warn(`RabbitMQ reconnect attempt ${attempt} in ${delay} ms`),
    );
    this.connection.on('error', (err: Error) => this.logger.error({ err }, 'RabbitMQ error'));
  }

  isConnected(): boolean {
    return this.channel !== null;
  }

  private async onMessage(channel: ConfirmChannel, msg: ConsumeMessage) {
    const job = this.parse(msg);
    if (!job) {
      // Can never succeed, so don't retry: reject without requeue -> dead-lettered to the DLQ.
      this.logger.error(`Malformed message ${msg.properties.messageId ?? ''}, sending to DLQ`);
      channel.nack(msg, false, false);
      return;
    }

    try {
      const result = await this.handler.handle(job);
      if (result.kind === 'retry') {
        await this.publish(
          channel,
          ROUTING_KEYS.retry,
          { ...job, attempt: result.nextAttempt },
          {
            // Per-message TTL: when it runs out, otp.send.retry dead-letters it back to otp.send.
            expiration: String(result.delayMs),
          },
        );
      } else if (result.kind === 'dead') {
        await this.publish(channel, ROUTING_KEYS.dead, job, {
          headers: { 'x-last-error': result.error },
        });
      } else if (result.kind === 'skipped') {
        this.logger.log(`Skipped ${job.requestId}: ${result.reason}`);
      } else {
        this.logger.log(`Sent ${job.channel} OTP for ${job.requestId} (try ${job.attempt})`);
      }
      channel.ack(msg);
    } catch (error) {
      // DB or broker trouble, not a provider failure: put the job back to be tried again.
      this.logger.error({ err: error }, `Could not process ${job.requestId}, requeueing`);
      await sleep(REQUEUE_DELAY_MS);
      try {
        channel.nack(msg, false, true);
      } catch {
        // Channel already closed: RabbitMQ re-delivers unacked messages by itself.
      }
    }
  }

  private parse(msg: ConsumeMessage): SendOtpJob | null {
    try {
      const value: unknown = JSON.parse(msg.content.toString('utf8'));
      return isSendOtpJob(value) ? value : null;
    } catch {
      return null;
    }
  }

  private publish(
    channel: ConfirmChannel,
    routingKey: string,
    job: SendOtpJob,
    options: Options.Publish,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      channel.publish(
        OTP_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(job)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: `${job.requestId}:${job.attempt}`,
          ...options,
        },
        (err: unknown) => (err ? reject(new Error(String(err))) : resolve()),
      );
    });
  }

  async onApplicationShutdown() {
    // Closing returns unacked messages to the queue, so another worker can take them.
    await this.connection?.close().catch(() => undefined);
  }
}
