'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { setSession } from '@/lib/session';
import type { LoginResponse } from '@/lib/types';

export interface LoginState {
  error?: string;
  email?: string;
}

/** Only allow redirects to our own pages (`/clients`), never to `//evil.com` or `https://…`. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  let session: LoginResponse;
  try {
    session = await api<LoginResponse>('/admin/auth/login', {
      method: 'POST',
      body: { email, password },
      redirectOn401: false,
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 429) return { error: error.message, email };
    if (error instanceof ApiError && error.status < 500) {
      return { error: 'Invalid email or password', email };
    }
    return { error: 'The API is not reachable. Is it running?', email };
  }

  await setSession(session.accessToken, new Date(session.expiresAt));
  redirect(safeNext(formData.get('next')));
}
