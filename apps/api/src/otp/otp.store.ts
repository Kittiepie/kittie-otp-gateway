import { Inject, Injectable } from '@nestjs/common';
import Redis, { type Result } from 'ioredis';
import { REDIS } from '../redis/redis.constants';

/**
 * Redis side of an OTP. All multi-step operations are Lua scripts: Redis runs a script as one
 * atomic step, so two concurrent requests can never interleave between "read" and "write".
 *
 * Keys (SRS §6):
 *   otp:{requestId}                         hash { codeHash, attempts, recipientHash, clientId }
 *   otp:active:{clientId}:{recipientHash}   requestId of the recipient's current OTP (FR-07)
 * Both expire with the OTP TTL, so expired codes clean themselves up.
 */

// Replaces the recipient's previous OTP (if any) and stores the new one. Returns the replaced id.
const SAVE_SCRIPT = `
local previous = redis.call('GET', KEYS[2])
if previous and previous ~= ARGV[1] then
  redis.call('DEL', 'otp:' .. previous)
end
redis.call('HSET', KEYS[1], 'codeHash', ARGV[2], 'attempts', 0, 'recipientHash', ARGV[3], 'clientId', ARGV[4])
redis.call('EXPIRE', KEYS[1], ARGV[5])
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[5])
return previous
`;

// Counts one verify attempt, unless the OTP is missing, belongs to another client, or is locked.
// Returns {0} missing | {2, attempts} locked | {1, attempts, codeHash, recipientHash} reserved.
const RESERVE_ATTEMPT_SCRIPT = `
local data = redis.call('HMGET', KEYS[1], 'codeHash', 'attempts', 'clientId', 'recipientHash')
if not data[1] or data[3] ~= ARGV[2] then
  return {0}
end
local attempts = tonumber(data[2])
if attempts >= tonumber(ARGV[1]) then
  return {2, attempts}
end
attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
return {1, attempts, data[1], data[4]}
`;

// Deletes the OTP after a successful verify. Returns 1 only for the caller that actually deleted
// it, which makes a code single-use even if two verify calls race.
const CONSUME_SCRIPT = `
local deleted = redis.call('DEL', KEYS[1])
if redis.call('GET', KEYS[2]) == ARGV[1] then
  redis.call('DEL', KEYS[2])
end
return deleted
`;

declare module 'ioredis' {
  interface RedisCommander<Context> {
    otpSave(
      otpKey: string,
      activeKey: string,
      requestId: string,
      codeHash: string,
      recipientHash: string,
      clientId: string,
      ttlSeconds: number,
    ): Result<string | null, Context>;
    otpReserveAttempt(
      otpKey: string,
      maxAttempts: number,
      clientId: string,
    ): Result<[number, number?, string?, string?], Context>;
    otpConsume(otpKey: string, activeKey: string, requestId: string): Result<number, Context>;
  }
}

export type ReserveResult =
  | { kind: 'missing' }
  | { kind: 'locked'; attempts: number }
  | { kind: 'reserved'; attempts: number; codeHash: string; recipientHash: string };

const otpKey = (requestId: string) => `otp:${requestId}`;
const activeKey = (clientId: string, recipientHash: string) =>
  `otp:active:${clientId}:${recipientHash}`;

@Injectable()
export class OtpStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    // defineCommand loads each script once and then calls it by SHA (EVALSHA).
    redis.defineCommand('otpSave', { numberOfKeys: 2, lua: SAVE_SCRIPT });
    redis.defineCommand('otpReserveAttempt', { numberOfKeys: 1, lua: RESERVE_ATTEMPT_SCRIPT });
    redis.defineCommand('otpConsume', { numberOfKeys: 2, lua: CONSUME_SCRIPT });
  }

  /** Stores a new OTP and returns the id of the OTP it replaced, if any. */
  save(params: {
    requestId: string;
    clientId: string;
    recipientHash: string;
    codeHash: string;
    ttlSeconds: number;
  }): Promise<string | null> {
    return this.redis.otpSave(
      otpKey(params.requestId),
      activeKey(params.clientId, params.recipientHash),
      params.requestId,
      params.codeHash,
      params.recipientHash,
      params.clientId,
      params.ttlSeconds,
    );
  }

  async reserveAttempt(
    requestId: string,
    clientId: string,
    maxAttempts: number,
  ): Promise<ReserveResult> {
    const [status, attempts, codeHash, recipientHash] = await this.redis.otpReserveAttempt(
      otpKey(requestId),
      maxAttempts,
      clientId,
    );
    if (status === 2) return { kind: 'locked', attempts: attempts ?? maxAttempts };
    if (status === 1 && attempts !== undefined && codeHash && recipientHash) {
      return { kind: 'reserved', attempts, codeHash, recipientHash };
    }
    return { kind: 'missing' };
  }

  /** True if this call removed the OTP; false if it was already gone. */
  async consume(requestId: string, clientId: string, recipientHash: string): Promise<boolean> {
    const deleted = await this.redis.otpConsume(
      otpKey(requestId),
      activeKey(clientId, recipientHash),
      requestId,
    );
    return deleted === 1;
  }
}
