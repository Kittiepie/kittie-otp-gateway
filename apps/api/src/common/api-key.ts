import { randomBytes } from 'node:crypto';
import { sha256Hex } from './crypto';

/**
 * API key format: `otp_<12 hex>.<43 base64url chars>`
 *   prefix (before the dot) is stored in plain text and indexed, so the key row can be found.
 *   The full key is stored only as a SHA-256 hash. Keys have 256 bits of randomness, so a fast
 *   hash is safe here (unlike passwords, which need a slow hash such as argon2).
 */
export interface GeneratedApiKey {
  prefix: string;
  fullKey: string;
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const prefix = `otp_${randomBytes(6).toString('hex')}`;
  const secret = randomBytes(32).toString('base64url');
  const fullKey = `${prefix}.${secret}`;
  return { prefix, fullKey, keyHash: hashApiKey(fullKey) };
}

export function hashApiKey(fullKey: string): string {
  return sha256Hex(fullKey);
}

/** Returns the prefix, or null when the value cannot be one of our keys. */
export function apiKeyPrefix(rawKey: string): string | null {
  const dot = rawKey.indexOf('.');
  return dot > 0 ? rawKey.slice(0, dot) : null;
}
