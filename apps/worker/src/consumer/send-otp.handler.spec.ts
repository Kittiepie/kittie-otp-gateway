import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { SendOtpJob } from '@otp/shared';
import type { Env } from '../config/env.validation';
import type { DatabaseService } from '../database/database.service';
import type { ChannelProvider } from '../providers/channel-provider';
import { SendOtpHandler } from './send-otp.handler';

beforeAll(() => Logger.overrideLogger(false));

const job: SendOtpJob = {
  requestId: 'req-1',
  channel: 'email',
  recipient: 'a@b.co',
  code: '123456',
  attempt: 1,
};

function setup({ status = 'REQUESTED', simulateFailure = false } = {}) {
  const db = {
    getStatus: jest.fn().mockResolvedValue(status),
    recordSent: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
  };
  const email: ChannelProvider = {
    channel: 'email',
    send: jest.fn().mockResolvedValue({ provider: 'smtp', messageId: 'm1' }),
  };
  const config = { get: () => simulateFailure } as unknown as ConfigService<Env, true>;
  const handler = new SendOtpHandler(db as unknown as DatabaseService, [email], config);
  return { handler, db, email };
}

describe('SendOtpHandler', () => {
  it('sends through the channel provider and records SENT', async () => {
    const { handler, db, email } = setup();
    await expect(handler.handle(job)).resolves.toEqual({ kind: 'sent' });
    expect(email.send).toHaveBeenCalledWith('a@b.co', '123456');
    expect(db.recordSent).toHaveBeenCalledWith('req-1', {
      attempt: 1,
      provider: 'smtp',
      messageId: 'm1',
    });
  });

  it.each(['SENT', 'VERIFIED', 'EXPIRED', 'LOCKED', null])(
    'skips a job whose request is %s (duplicate or stale delivery)',
    async (status) => {
      const { handler, email } = setup({ status: status as string });
      await expect(handler.handle(job)).resolves.toMatchObject({ kind: 'skipped' });
      expect(email.send).not.toHaveBeenCalled();
    },
  );

  it('asks for a retry when the provider fails before the last try', async () => {
    const { handler, db, email } = setup();
    (email.send as jest.Mock).mockRejectedValueOnce(new Error('SMTP down'));

    await expect(handler.handle(job)).resolves.toEqual({
      kind: 'retry',
      nextAttempt: 2,
      delayMs: 5_000,
      error: 'SMTP down',
    });
    expect(db.recordFailure).toHaveBeenCalledWith(
      'req-1',
      { attempt: 1, error: 'SMTP down', final: false },
      false,
    );
  });

  it('sends the job to the DLQ after the last try and marks the request FAILED', async () => {
    const { handler, db, email } = setup();
    (email.send as jest.Mock).mockRejectedValueOnce(new Error('SMTP down'));

    await expect(handler.handle({ ...job, attempt: 3 })).resolves.toMatchObject({ kind: 'dead' });
    expect(db.recordFailure).toHaveBeenCalledWith('req-1', expect.anything(), true);
  });

  it('fails every send when WORKER_SIMULATE_FAILURE is on', async () => {
    const { handler, email } = setup({ simulateFailure: true });
    await expect(handler.handle(job)).resolves.toMatchObject({ kind: 'retry' });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('treats a channel without provider as a failed send', async () => {
    const { handler } = setup();
    await expect(handler.handle({ ...job, channel: 'sms' })).resolves.toMatchObject({
      kind: 'retry',
      error: 'No provider for channel sms',
    });
  });
});
