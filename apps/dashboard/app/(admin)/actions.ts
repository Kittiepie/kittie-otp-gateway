'use server';

import { redirect } from 'next/navigation';
import { clearSession } from '@/lib/session';

export async function logout(): Promise<void> {
  // The JWT is stateless, so "logging out" means forgetting it. It stays technically valid
  // until it expires; a server-side denylist would be needed to kill it earlier.
  await clearSession();
  redirect('/login');
}
