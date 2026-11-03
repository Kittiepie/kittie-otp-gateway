import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { sha256Hex } from '../common/crypto';
import type { Env } from '../config/env.validation';
import { REDIS } from '../redis/redis.module';

interface StoredEntry<T> {
  state: 'pending' | 'done';
  fingerprint: string;
  response?: T;
}

/** A pending claim expires on its own if the process dies mid-request. */
const PENDING_TTL_SECONDS = 60;
const KEY_PATTERN = /^[\w-]{1,128}$/;

/**
 * `Idempotency-Key` support (NFR-07): a client that retries a request after a timeout gets the
 * first response back instead of a second OTP.
 *
 * 1. SET NX claims the key ("pending"). Only one concurrent request can win the claim.
 * 2. On success the response is stored for 24 h; replays return it.
 * 3. On error the claim is removed, so the client may retry.
 * The body fingerprint catches a key reused for a different request.
 */
@Injectable()
export class IdempotencyService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = config.get('IDEMPOTENCY_TTL_SECONDS', { infer: true });
  }

  async execute<T>(
    clientId: string,
    idempotencyKey: string | undefined,
    body: unknown,
    run: () => Promise<T>,
  ): Promise<{ response: T; replayed: boolean }> {
    if (idempotencyKey === undefined) return { response: await run(), replayed: false };
    if (!KEY_PATTERN.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key must be 1-128 letters, digits, _ or -');
    }

    const redisKey = `idem:${clientId}:${idempotencyKey}`;
    const fingerprint = sha256Hex(JSON.stringify(body));
    const pending: StoredEntry<T> = { state: 'pending', fingerprint };

    const claimed = await this.redis.set(
      redisKey,
      JSON.stringify(pending),
      'EX',
      PENDING_TTL_SECONDS,
      'NX',
    );
    if (!claimed) return { response: await this.replay<T>(redisKey, fingerprint), replayed: true };

    try {
      const response = await run();
      const done: StoredEntry<T> = { state: 'done', fingerprint, response };
      await this.redis.set(redisKey, JSON.stringify(done), 'EX', this.ttlSeconds);
      return { response, replayed: false };
    } catch (error) {
      await this.redis.del(redisKey);
      throw error;
    }
  }

  private async replay<T>(redisKey: string, fingerprint: string): Promise<T> {
    const raw = await this.redis.get(redisKey);
    const entry = raw ? (JSON.parse(raw) as StoredEntry<T>) : null;
    if (!entry || entry.state === 'pending') {
      throw new ConflictException('A request with this Idempotency-Key is still in progress');
    }
    if (entry.fingerprint !== fingerprint) {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used with a different request body',
      );
    }
    return entry.response as T;
  }
}
