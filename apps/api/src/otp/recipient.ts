import type { OtpChannel } from '@otp/shared';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** E.164-like: optional +, 8 to 15 digits, no leading zero after the +. */
const PHONE_PATTERN = /^\+?\d{8,15}$/;

/** One canonical form per recipient, so `A@x.com` and `a@x.com ` count as the same person. */
export function normalizeRecipient(channel: OtpChannel, raw: string): string {
  return channel === 'email' ? raw.trim().toLowerCase() : raw.replace(/[\s()-]/g, '');
}

export function isValidRecipient(channel: OtpChannel, normalized: string): boolean {
  return channel === 'email' ? EMAIL_PATTERN.test(normalized) : PHONE_PATTERN.test(normalized);
}

/** For logs and the dashboard (NFR-04): `a***@gmail.com`, `09******12`. */
export function maskRecipient(channel: OtpChannel, normalized: string): string {
  if (channel === 'email') {
    const [local, domain] = normalized.split('@');
    return `${local.slice(0, 1)}***@${domain}`;
  }
  const visible = 2;
  return `${normalized.slice(0, visible)}${'*'.repeat(Math.max(normalized.length - visible * 2, 0))}${normalized.slice(-visible)}`;
}
