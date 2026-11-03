import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader, TableSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import type { Client } from '@/lib/types';
import { TestSendPanel } from './test-send-panel';

export const metadata: Metadata = { title: 'Test send' };

export default function TestSendPage() {
  return (
    <>
      <PageHeader title="Test send" />
      <p className="mb-6 max-w-2xl text-sm text-zinc-600">
        Runs the real flow (rate limits, queue, worker, audit log) as the chosen client, without
        needing its API key.
      </p>
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <Panel />
      </Suspense>
    </>
  );
}

async function Panel() {
  const clients = await api<Client[]>('/admin/clients');
  const active = clients
    .filter((client) => client.status === 'active')
    .map(({ id, name }) => ({ id, name }));
  // Read at request time on the server, so the same image works in every environment
  // (a NEXT_PUBLIC_ variable would be frozen into the JavaScript at build time).
  const mailpitUrl = process.env.MAILPIT_URL ?? 'http://localhost:8025';
  return <TestSendPanel clients={active} mailpitUrl={mailpitUrl} />;
}
