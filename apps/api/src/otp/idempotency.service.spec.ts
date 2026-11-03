import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { Env } from '../config/env.validation';
import { IdempotencyService } from './idempotency.service';

/** Just enough of Redis (GET / SET with NX / DEL) kept in a Map. */
class FakeRedis {
  store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string, ...args: unknown[]) {
    if (args.includes('NX') && this.store.has(key)) return null;
    this.store.set(key, value);
    return 'OK';
  }
  async del(key: string) {
    return this.store.delete(key) ? 1 : 0;
  }
}

function setup() {
  const redis = new FakeRedis();
  const config = { get: () => 86_400 } as unknown as ConfigService<Env, true>;
  const service = new IdempotencyService(redis as unknown as Redis, config);
  return { redis, service };
}

describe('IdempotencyService', () => {
  const body = { recipient: 'a@b.co', channel: 'email' };

  it('runs the handler once and replays the stored response', async () => {
    const { service } = setup();
    const run = jest.fn().mockResolvedValue({ requestId: 'r1' });

    const first = await service.execute('c1', 'key-1', body, run);
    const second = await service.execute('c1', 'key-1', body, run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ response: { requestId: 'r1' }, replayed: false });
    expect(second).toEqual({ response: { requestId: 'r1' }, replayed: true });
  });

  it('runs every time when no key is given', async () => {
    const { service } = setup();
    const run = jest.fn().mockResolvedValue({});
    await service.execute('c1', undefined, body, run);
    await service.execute('c1', undefined, body, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps keys separate per client', async () => {
    const { service } = setup();
    const run = jest.fn().mockResolvedValue({});
    await service.execute('c1', 'same', body, run);
    await service.execute('c2', 'same', body, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('rejects the same key with a different body (422)', async () => {
    const { service } = setup();
    await service.execute('c1', 'k', body, async () => ({}));
    await expect(
      service.execute('c1', 'k', { ...body, recipient: 'x@y.co' }, async () => ({})),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('answers 409 while the first request is still running', async () => {
    const { service } = setup();
    let finish!: () => void;
    const slow = service.execute(
      'c1',
      'k',
      body,
      () => new Promise<object>((resolve) => (finish = () => resolve({}))),
    );
    await expect(service.execute('c1', 'k', body, async () => ({}))).rejects.toBeInstanceOf(
      ConflictException,
    );
    finish();
    await slow;
  });

  it('forgets the key when the handler fails, so the client can retry', async () => {
    const { service, redis } = setup();
    await expect(
      service.execute('c1', 'k', body, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(redis.store.size).toBe(0);
  });

  it('rejects malformed keys', async () => {
    const { service } = setup();
    await expect(service.execute('c1', 'has space', body, async () => ({}))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
