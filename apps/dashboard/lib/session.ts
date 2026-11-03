import 'server-only';
import { cookies } from 'next/headers';

/**
 * The dashboard keeps the admin JWT (issued by the api) in its own httpOnly cookie.
 * The browser never sees the token in JavaScript; the dashboard's server reads the cookie and
 * forwards the token to the api as `Authorization: Bearer`.
 */
export const SESSION_COOKIE = 'otp_session';

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Only callable from Server Actions (cookies can't be written while rendering). */
export async function setSession(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
