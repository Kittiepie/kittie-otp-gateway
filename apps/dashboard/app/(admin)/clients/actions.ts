'use server';

import { refresh } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { CreatedKey } from '@/lib/types';

export interface KeyActionState {
  apiKey?: string;
  label?: string;
  error?: string;
}

function errorMessage(error: unknown): string {
  // Redirects (e.g. session expired) are thrown as special errors; let Next.js handle them.
  unstable_rethrow(error);
  if (error instanceof ApiError) {
    const details = error.body?.details;
    return Array.isArray(details) ? details.join(', ') : error.message;
  }
  return 'Something went wrong. Is the API running?';
}

export async function createClient(
  _prev: KeyActionState,
  formData: FormData,
): Promise<KeyActionState> {
  const name = String(formData.get('name') ?? '').trim();
  const rateLimitPerMin = Number(formData.get('rateLimitPerMin') || 60);
  try {
    const created = await api<CreatedKey & { client: { name: string } }>('/admin/clients', {
      method: 'POST',
      body: { name, rateLimitPerMin },
    });
    // Re-render the current page on the server so the new client shows up in the list.
    refresh();
    return { apiKey: created.apiKey, label: created.client.name };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

/** Bound to one client with .bind(); useActionState's previous state isn't needed. */
export async function createKey(clientId: string, clientName: string): Promise<KeyActionState> {
  try {
    const created = await api<CreatedKey>(`/admin/clients/${clientId}/keys`, { method: 'POST' });
    refresh();
    return { apiKey: created.apiKey, label: clientName };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function revokeClient(clientId: string): Promise<void> {
  await api(`/admin/clients/${clientId}`, { method: 'DELETE' });
  refresh();
}

export async function revokeKey(clientId: string, keyId: string): Promise<void> {
  await api(`/admin/clients/${clientId}/keys/${keyId}`, { method: 'DELETE' });
  refresh();
}
