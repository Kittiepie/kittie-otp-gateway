import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OtpChannel, SendOtpJob } from '@otp/shared';
import type { Env } from '../config/env.validation';
import { DatabaseService } from '../database/database.service';
import { CHANNEL_PROVIDERS, type ChannelProvider } from '../providers/channel-provider';
import { decideOnFailure, type FailureAction } from './retry-policy';

export type HandleResult =
  { kind: 'sent' } | { kind: 'skipped'; reason: string } | (FailureAction & { error: string });

/**
 * What to do with one job. No RabbitMQ code here: the consumer turns the result into
 * ack / retry / DLQ, which keeps this class easy to unit test.
 */
@Injectable()
export class SendOtpHandler {
  private readonly logger = new Logger(SendOtpHandler.name);
  private readonly providers: Map<OtpChannel, ChannelProvider>;
  private readonly simulateFailure: boolean;

  constructor(
    private readonly db: DatabaseService,
    @Inject(CHANNEL_PROVIDERS) providers: ChannelProvider[],
    config: ConfigService<Env, true>,
  ) {
    this.providers = new Map(providers.map((p) => [p.channel, p]));
    this.simulateFailure = config.get('WORKER_SIMULATE_FAILURE', { infer: true });
  }

  async handle(job: SendOtpJob): Promise<HandleResult> {
    // RabbitMQ delivers at least once, so the same job can arrive twice (e.g. the worker crashed
    // before its ack). Only REQUESTED still needs sending; anything else means "already sent",
    // "verified", or "replaced/expired". Sending an old code would only confuse the user.
    const status = await this.db.getStatus(job.requestId);
    if (status !== 'REQUESTED') {
      return { kind: 'skipped', reason: status ? `status is ${status}` : 'unknown request' };
    }

    try {
      if (this.simulateFailure) throw new Error('Simulated failure (WORKER_SIMULATE_FAILURE=true)');
      const provider = this.providers.get(job.channel);
      if (!provider) throw new Error(`No provider for channel ${job.channel}`);

      const result = await provider.send(job.recipient, job.code);
      await this.db.recordSent(job.requestId, { attempt: job.attempt, ...result });
      return { kind: 'sent' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const action = decideOnFailure(job.attempt);
      await this.db.recordFailure(
        job.requestId,
        { attempt: job.attempt, error: message, final: action.kind === 'dead' },
        action.kind === 'dead',
      );
      this.logger.warn(
        `Send failed for ${job.requestId} (try ${job.attempt}): ${message} -> ${action.kind}`,
      );
      return { ...action, error: message };
    }
  }
}
