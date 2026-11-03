'use client';

import { useActionState } from 'react';
import { Alert, Button, Field, inputClass } from '@/components/ui';
import { login, type LoginState } from './actions';

export function LoginForm({ next, expired }: { next?: string; expired: boolean }) {
  // useActionState: runs the Server Action on submit and gives back its return value (errors)
  // plus a `pending` flag, without any client-side fetch code.
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      {expired && !state.error && (
        <Alert kind="error">Your session expired. Please log in again.</Alert>
      )}
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? '/'} />
      <Field label="Email">
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state.email}
          className={inputClass}
        />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  );
}
