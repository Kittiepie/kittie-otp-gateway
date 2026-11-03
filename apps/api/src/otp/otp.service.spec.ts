import {
  BadRequestException,
  GoneException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { hmacSha256Hex } from '../common/crypto';
import { RateLimitedException } from '../common/exceptions/rate-limited.exception';
import type { Env } from '../config/env.validation';
import type { Client } from '../generated/prisma/client';
import type { OtpJobPublisher } from '../messaging/otp-job.publisher';
import type { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp.service';
import type { OtpStore } from './otp.store';
import type { RateLimiterService } from '../redis/rate-limiter.service';

const SECRET = 'test-secret-at-least-16-chars';
const REQUEST_ID = '0b9f3c1e-8a52-4c1d-9d0e-6f7a8b9c0d1e';

const env: Partial<Env> = {
  OTP_HMAC_SECRET: SECRET,
  OTP_TTL_SECONDS: 300,
  OTP_MAX_ATTEMPTS: 5,
  RATE_LIMIT_RECIPIENT_MAX: 3,
  RATE_LIMIT_RECIPIENT_WINDOW_SECONDS: 600,
};

const client = { id: 'client-1', rateLimitPerMin: 60, status: 'active' } as Client;
const codeHash = (code: string) => hmacSha256Hex(SECRET, `otp:${REQUEST_ID}:${code}`);

beforeAll(() => Logger.overrideLogger(false));

function setup() {
  const tx = {
    otpRequest: { create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    otpEvent: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    otpRequest: { findFirst: jest.fn(), update: jest.fn() },
  };
  const store = {
    save: jest.fn().mockResolvedValue(null),
    reserveAttempt: jest.fn(),
    consume: jest.fn().mockResolvedValue(true),
  };
  const rateLimiter = { consume: jest.fn().mockResolvedValue(undefined) };
  const publisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (key: keyof Env) => env[key] };

  const service = new OtpService(
    prisma as unknown as PrismaService,
    store as unknown as OtpStore,
    rateLimiter as unknown as RateLimiterService,
    publisher as unknown as OtpJobPublisher,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, tx, prisma, store, rateLimiter, publisher };
}

describe('OtpService.request', () => {
  it('stores only a hash, publishes the plain code, and returns 202 data', async () => {
    const { service, store, publisher, tx } = setup();

    const result = await service.request(client, {
      recipient: ' Alice@Example.COM ',
      channel: 'email',
    });

    const job = publisher.publish.mock.calls[0][0];
    expect(job).toMatchObject({ channel: 'email', recipient: 'alice@example.com', attempt: 1 });
    expect(job.code).toMatch(/^\d{6}$/);
    expect(result.requestId).toBe(job.requestId);

    const saved = store.save.mock.calls[0][0];
    expect(saved.codeHash).toBe(hmacSha256Hex(SECRET, `otp:${job.requestId}:${job.code}`));
    expect(saved.codeHash).not.toContain(job.code);
    expect(tx.otpRequest.create.mock.calls[0][0].data.recipientMasked).toBe('a***@example.com');
    expect(tx.otpEvent.create.mock.calls[0][0].data.type).toBe('REQUESTED');
  });

  it('rejects an invalid recipient before counting rate limits', async () => {
    const { service, rateLimiter } = setup();
    await expect(
      service.request(client, { recipient: 'not-a-phone', channel: 'sms' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rateLimiter.consume).not.toHaveBeenCalled();
  });

  it('stops when rate limited, without storing anything', async () => {
    const { service, rateLimiter, store, publisher } = setup();
    rateLimiter.consume.mockRejectedValueOnce(new RateLimitedException(30));
    await expect(
      service.request(client, { recipient: 'a@b.co', channel: 'email' }),
    ).rejects.toBeInstanceOf(RateLimitedException);
    expect(store.save).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('marks the replaced OTP as EXPIRED (FR-07)', async () => {
    const { service, store, tx } = setup();
    store.save.mockResolvedValueOnce('old-request-id');

    await service.request(client, { recipient: 'a@b.co', channel: 'email' });

    expect(tx.otpRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'old-request-id' }),
        data: { status: 'EXPIRED' },
      }),
    );
  });

  it('removes the OTP and returns 503 when the job cannot be queued', async () => {
    const { service, store, publisher, tx } = setup();
    publisher.publish.mockRejectedValueOnce(new Error('broker down'));

    await expect(
      service.request(client, { recipient: 'a@b.co', channel: 'email' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(store.consume).toHaveBeenCalled();
    expect(tx.otpRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
  });
});

describe('OtpService.verify', () => {
  const reserved = (attempts: number, hash = codeHash('123456')) => ({
    kind: 'reserved',
    attempts,
    codeHash: hash,
    recipientHash: 'r-hash',
  });

  it('verifies the right code once and consumes it', async () => {
    const { service, store, tx } = setup();
    store.reserveAttempt.mockResolvedValueOnce(reserved(1));

    await expect(
      service.verify(client, { requestId: REQUEST_ID, code: '123456' }),
    ).resolves.toEqual({ verified: true });
    expect(store.consume).toHaveBeenCalledWith(REQUEST_ID, client.id, 'r-hash');
    expect(tx.otpEvent.create.mock.calls[0][0].data.type).toBe('VERIFIED');
  });

  it('returns 410 when a concurrent call consumed the code first', async () => {
    const { service, store } = setup();
    store.reserveAttempt.mockResolvedValueOnce(reserved(1));
    store.consume.mockResolvedValueOnce(false);
    await expect(
      service.verify(client, { requestId: REQUEST_ID, code: '123456' }),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('returns 400 with attempts remaining for a wrong code', async () => {
    const { service, store } = setup();
    store.reserveAttempt.mockResolvedValueOnce(reserved(2));

    const error = await service
      .verify(client, { requestId: REQUEST_ID, code: '000000' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({ attemptsRemaining: 3 });
    expect(store.consume).not.toHaveBeenCalled();
  });

  it('locks on the 5th wrong code (423) and records LOCKED', async () => {
    const { service, store, tx } = setup();
    store.reserveAttempt.mockResolvedValueOnce(reserved(5));

    const error = await service
      .verify(client, { requestId: REQUEST_ID, code: '000000' })
      .catch((e: unknown) => e);
    expect((error as HttpException).getStatus()).toBe(423);
    expect(tx.otpEvent.create.mock.calls[0][0].data.type).toBe('LOCKED');
  });

  it('stays locked even for the right code', async () => {
    const { service, store } = setup();
    store.reserveAttempt.mockResolvedValueOnce({ kind: 'locked', attempts: 5 });
    const error = await service
      .verify(client, { requestId: REQUEST_ID, code: '123456' })
      .catch((e: unknown) => e);
    expect((error as HttpException).getStatus()).toBe(423);
  });

  it.each([
    ['unknown request', null, NotFoundException],
    ['already verified', { status: 'VERIFIED' }, GoneException],
    ['expired', { status: 'SENT' }, GoneException],
  ])('missing Redis key, %s', async (_name, row, expected) => {
    const { service, store, prisma } = setup();
    store.reserveAttempt.mockResolvedValueOnce({ kind: 'missing' });
    prisma.otpRequest.findFirst.mockResolvedValueOnce(row);
    await expect(
      service.verify(client, { requestId: REQUEST_ID, code: '123456' }),
    ).rejects.toBeInstanceOf(expected);
  });
});
