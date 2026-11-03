'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Field, inputClass } from '@/components/ui';
import { createClient, createKey, type KeyActionState } from './actions';
import { KeyDialog } from './key-dialog';

/** Remembers which key the admin already dismissed, so the dialog doesn't reopen on re-render. */
function useKeyDialog(state: KeyActionState) {
  const [dismissed, setDismissed] = useState<string | undefined>();
  const open = state.apiKey !== undefined && state.apiKey !== dismissed;
  return {
    dialog: open ? (
      <KeyDialog
        apiKey={state.apiKey!}
        label={state.label}
        onClose={() => setDismissed(state.apiKey)}
      />
    ) : null,
  };
}

export function CreateClientForm() {
  const [state, formAction, pending] = useActionState(createClient, {});
  const { dialog } = useKeyDialog(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        <Field label="Client name">
          <input name="name" required minLength={2} maxLength={100} className={inputClass} />
        </Field>
      </div>
      <div className="w-40">
        <Field label="Requests / minute">
          <input
            name="rateLimitPerMin"
            type="number"
            min={1}
            max={10000}
            defaultValue={60}
            className={inputClass}
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create client'}
      </Button>
      {state.error && (
        <div className="w-full">
          <Alert kind="error">{state.error}</Alert>
        </div>
      )}
      {dialog}
    </form>
  );
}

export function NewKeyButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [state, formAction, pending] = useActionState(
    createKey.bind(null, clientId, clientName),
    {},
  );
  const { dialog } = useKeyDialog(state);

  return (
    <form action={formAction}>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Creating…' : 'New key'}
      </Button>
      {state.error && <span className="ml-2 text-xs text-red-700">{state.error}</span>}
      {dialog}
    </form>
  );
}

/** A form button that asks for confirmation before running a destructive Server Action. */
export function ConfirmButton({
  action,
  confirmText,
  children,
}: {
  action: () => Promise<void>;
  confirmText: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="danger"
        onClick={(event) => {
          if (!window.confirm(confirmText)) event.preventDefault();
        }}
      >
        {children}
      </Button>
    </form>
  );
}
