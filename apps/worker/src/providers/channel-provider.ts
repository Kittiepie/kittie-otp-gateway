import type { OtpChannel } from '@otp/shared';

export interface DeliveryResult {
  /** Which provider delivered it, for the audit log. */
  provider: string;
  messageId?: string;
}

/**
 * One implementation per channel. Adding a real SMS provider later means writing one more class
 * with this shape; the consumer and retry logic don't change.
 */
export interface ChannelProvider {
  readonly channel: OtpChannel;
  send(recipient: string, code: string): Promise<DeliveryResult>;
}

/** Injection token for the list of all providers. */
export const CHANNEL_PROVIDERS = Symbol('CHANNEL_PROVIDERS');
