import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Card, PageHeader, StatusBadge, TableSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Client } from '@/lib/types';
import { revokeClient, revokeKey } from './actions';
import { ConfirmButton, CreateClientForm, NewKeyButton } from './client-forms';

export const metadata: Metadata = { title: 'Clients' };

export default function ClientsPage() {
  return (
    <>
      <PageHeader title="Clients" />
      <Card className="mb-6">
        <CreateClientForm />
      </Card>
      <Suspense fallback={<TableSkeleton />}>
        <ClientList />
      </Suspense>
    </>
  );
}

async function ClientList() {
  const clients = await api<Client[]>('/admin/clients');
  if (clients.length === 0) {
    return <p className="text-sm text-zinc-500">No clients yet. Create one above.</p>;
  }

  return (
    <div className="space-y-4">
      {clients.map((client) => (
        <Card key={client.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{client.name}</h2>
                <StatusBadge status={client.status} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {client.rateLimitPerMin} requests/min · created {formatDateTime(client.createdAt)}
                <span className="ml-2 font-mono">{client.id}</span>
              </p>
            </div>
            {client.status === 'active' && (
              <div className="flex gap-2">
                <NewKeyButton clientId={client.id} clientName={client.name} />
                <ConfirmButton
                  action={revokeClient.bind(null, client.id)}
                  confirmText={`Revoke "${client.name}" and all its keys? Its apps will stop working.`}
                >
                  Revoke client
                </ConfirmButton>
              </div>
            )}
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-2">Key prefix</th>
                <th>Created</th>
                <th>Last used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {client.apiKeys.map((key) => (
                <tr key={key.id}>
                  <td className="py-2 font-mono">{key.prefix}.••••</td>
                  <td>{formatDateTime(key.createdAt)}</td>
                  <td>{formatDateTime(key.lastUsedAt)}</td>
                  <td>
                    <StatusBadge status={key.revokedAt ? 'revoked' : 'active'} />
                  </td>
                  <td className="text-right">
                    {!key.revokedAt && (
                      <ConfirmButton
                        action={revokeKey.bind(null, client.id, key.id)}
                        confirmText={`Revoke key ${key.prefix}? Apps using it will get 401.`}
                      >
                        Revoke
                      </ConfirmButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
