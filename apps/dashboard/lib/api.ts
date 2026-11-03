import 'server-only';
import { redirect } from 'next/navigation';
import { getSessionToken } from './session';

/** Server-only: the browser never calls the api directly, so this needs no NEXT_PUBLIC_ prefix. */
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** false for login, where a 401 means "wrong password", not "session expired". */
  redirectOn401?: boolean;
}

/**
 * Calls the admin API from the dashboard's server with the admin's token.
 * `cache: 'no-store'`: admin data must always be fresh, never served from a cache.
 */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, redirectOn401 = true, headers, ...init } = options;
  const token = await getSessionToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && redirectOn401) redirect('/login?expired=1');

  const data = (res.status === 204 ? undefined : await res.json().catch(() => undefined)) as
    Record<string, unknown> | undefined;
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : res.statusText;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}
