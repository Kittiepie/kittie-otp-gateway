import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Keyed hash: without the secret, nobody can brute-force 6-digit codes from a leaked hash. */
export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Compares two hex digests in constant time. A normal `===` returns as soon as one character
 * differs, and that timing difference can leak how much of a guess was right.
 */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
