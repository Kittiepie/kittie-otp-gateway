import type { OtpChannel, OtpStatus } from '@otp/shared';

// Response shapes of the admin API (see the api's DTOs or Swagger at /docs).
// Dates arrive as ISO strings because they went through JSON.

export interface ApiKey {
  id: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface Client {
  id: string;
  name: string;
  status: 'active' | 'revoked';
  rateLimitPerMin: number;
  createdAt: string;
  apiKeys: ApiKey[];
}

export interface CreatedKey {
  apiKey: string;
  key: ApiKey;
}

export interface OtpEvent {
  type: OtpStatus;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface OtpLog {
  id: string;
  client: { id: string; name: string };
  recipientMasked: string;
  channel: OtpChannel;
  purpose: string | null;
  status: OtpStatus;
  attempts: number;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
  events: OtpEvent[];
}

export interface LogsPage {
  items: OtpLog[];
  nextCursor: string | null;
}

export interface DailyStats {
  day: string;
  requested: number;
  verified: number;
  failed: number;
  locked: number;
  expired: number;
}

export interface Stats {
  days: DailyStats[];
  totals: Omit<DailyStats, 'day'> & { successRate: number };
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  admin: { id: string; email: string };
}
