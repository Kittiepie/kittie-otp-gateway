/** Delivery channels. `sms` is a mock that only logs the message. */
export const OTP_CHANNELS = ['email', 'sms'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

/**
 * Lifecycle of one OTP request (column `otp_requests.status`):
 * REQUESTED -> SENT | FAILED -> VERIFIED | LOCKED | EXPIRED
 */
export const OTP_STATUSES = [
  'REQUESTED',
  'SENT',
  'FAILED',
  'VERIFIED',
  'LOCKED',
  'EXPIRED',
] as const;
export type OtpStatus = (typeof OTP_STATUSES)[number];

/** Audit-log event types (column `otp_events.type`). */
export const OTP_EVENT_TYPES = OTP_STATUSES;
export type OtpEventType = OtpStatus;
