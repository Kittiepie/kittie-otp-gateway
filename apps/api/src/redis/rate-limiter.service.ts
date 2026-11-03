import { Inject, Injectable } from '@nestjs/common';
import Redis, { type Result } from 'ioredis';
import { RateLimitedException } from '../common/exceptions/rate-limited.exception';
import { REDIS } from './redis.constants';

/**
 * Fixed-window counter: INCR the key, and on the first hit set its expiry to the window length.
 * Done in Lua so INCR and EXPIRE can't be split by a crash (which would leave a counter that
 * never expires and blocks the recipient forever).
 */
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}
`;

declare module 'ioredis' {
  interface RedisCommander<Context> {
    rateLimitHit(key: string, windowSeconds: number): Result<[number, number], Context>;
  }
}

@Injectable()
export class RateLimiterService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    redis.defineCommand('rateLimitHit', { numberOfKeys: 1, lua: HIT_SCRIPT });
  }

  /** Counts one hit; throws 429 with Retry-After once `limit` is exceeded in the window. */
  async consume(key: string, limit: number, windowSeconds: number, message: string) {
    const [count, ttl] = await this.redis.rateLimitHit(key, windowSeconds);
    if (count > limit) {
      throw new RateLimitedException(ttl > 0 ? ttl : windowSeconds, message);
    }
  }
}
