'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, Field, inputClass } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { requestTestOtp, verifyTestOtp, type RequestState, type VerifyState } from './actions';

export function TestSendPanel({
  clients,
  mailpitUrl,
}: {
  clients: { id: string; name: string }[];
  mailpitUrl: string;
}) {
  const [request, requestAction, requesting] = useActionState<RequestState, FormData>(
    requestTestOtp,
    {},
  );
  const [verify, verifyAction, verifying] = useActionState<VerifyState, FormData>(
    verifyTestOtp,
    {},
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 font-semibold">1. Send an OTP</h2>
        <form action={requestAction} className="space-y-4">
          <Field label="As client">
            <select name="clientId" required className={inputClass}>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Channel">
            <select name="channel" className={inputClass} defaultValue="email">
              <option value="email">email (Mailpit)</option>
              <option value="sms">sms (mock, see worker log)</option>
            </select>
          </Field>
          <Field label="Recipient">
            <input name="recipient" required placeholder="you@example.com" className={inputClass} />
          </Field>
          <Button type="submit" disabled={requesting || clients.length === 0}>
            {requesting ? 'Sending…' : 'Send OTP'}
          </Button>
        </form>
        <div className="mt-4 space-y-2">
          {request.error && <Alert kind="error">{request.error}</Alert>}
          {request.requestId && (
            <Alert kind="success">
              Queued. Request <span className="font-mono">{request.requestId}</span>, expires{' '}
              {formatDateTime(request.expiresAt ?? null)}.{' '}
              {request.channel === 'email' ? (
                <a href={mailpitUrl} target="_blank" rel="noreferrer" className="underline">
                  Open Mailpit to read the code
                </a>
              ) : (
                'The code is in the worker log (mock SMS).'
              )}
            </Alert>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">2. Verify the code</h2>
        <form action={verifyAction} className="space-y-4">
          {/* key: reset the inputs when a new OTP is requested */}
          <input type="hidden" name="clientId" value={request.clientId ?? ''} />
          <Field label="Request id">
            <input
              key={request.requestId}
              name="requestId"
              required
              defaultValue={request.requestId}
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field label="Code">
            <input
              name="code"
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              className={`${inputClass} font-mono tracking-widest`}
            />
          </Field>
          <Button type="submit" disabled={verifying || !request.clientId}>
            {verifying ? 'Checking…' : 'Verify'}
          </Button>
        </form>
        {verify.message && (
          <div className="mt-4">
            <Alert kind={verify.verified ? 'success' : 'error'}>{verify.message}</Alert>
          </div>
        )}
      </Card>
    </div>
  );
}
