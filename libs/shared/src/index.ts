// Placeholder export so the workspace link can be verified.
// Queue contracts (SendOtpJob, routing keys) land here in Phase 3.
export const OTP_CHANNELS = ['email', 'sms'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];
