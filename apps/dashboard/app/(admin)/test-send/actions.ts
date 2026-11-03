'use server';

import type { OtpChannel } from '@otp/shared';
import { unstable_rethrow } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

export interface RequestState {
  requestId?: string;
  expiresAt?: string;
  clientId?: string;
  channel?: OtpChannel;
  error?: string;
}

export interface VerifyState {
  verified?: boolean;
  message?: string;
}

function describe(error: unknown): string {
  unstable_rethrow(error);
  if (!(error instanceof ApiError)) return 'Something went wrong. Is the API running?';
  const details = error.body?.details;
  if (Array.isArray(details)) return details.join(', ');
  const remaining = error.body?.attemptsRemaining;
  return typeof remaining === 'number'
    ? `${error.message} (${remaining} tries left)`
    : `${error.message} (HTTP ${error.status})`;
}

export async function requestTestOtp(
  _prev: RequestState,
  formData: FormData,
): Promise<RequestState> {
  const clientId = String(formData.get('clientId') ?? '');
  const channel = String(formData.get('channel') ?? 'email') as OtpChannel;
  try {
    const result = await api<{ requestId: string; expiresAt: string }>('/admin/test/request', {
      method: 'POST',
      body: {
        clientId,
        channel,
        recipient: String(formData.get('recipient') ?? ''),
        purpose: 'dashboard-test',
      },
    });
    return { ...result, clientId, channel };
  } catch (error) {
    return { error: describe(error) };
  }
}

export async function verifyTestOtp(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  try {
    await api<{ verified: boolean }>('/admin/test/verify', {
      method: 'POST',
      body: {
        clientId: String(formData.get('clientId') ?? ''),
        requestId: String(formData.get('requestId') ?? ''),
        code: String(formData.get('code') ?? '').trim(),
      },
    });
    return { verified: true, message: 'Code verified.' };
  } catch (error) {
    return { verified: false, message: describe(error) };
  }
}
