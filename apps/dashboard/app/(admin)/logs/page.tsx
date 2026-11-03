import { OTP_CHANNELS, OTP_STATUSES } from '@otp/shared';
import type { Metadata } from 'next';
import Form from 'next/form';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button, Card, Field, inputClass, PageHeader, StatusBadge, TableSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Client, LogsPage } from '@/lib/types';

export const metadata: Metadata = { title: 'Logs' };

type SearchParams = Awaited<PageProps<'/logs'>['searchParams']>;

const FILTER_KEYS = ['status', 'channel', 'clientId', 'recipient', 'from', 'to'] as const;

function param(params: SearchParams, key: string): string {
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

export default function LogsPage({ searchParams }: PageProps<'/logs'>) {
  return (
    <>
      <PageHeader title="OTP logs" />
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <Logs searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Logs({ searchParams }: Pick<PageProps<'/logs'>, 'searchParams'>) {
  const params = await searchParams;

  // Filters live in the URL, so a filtered view can be bookmarked, shared and reloaded.
  const query = new URLSearchParams({ limit: '25' });
  for (const key of FILTER_KEYS) {
    const value = param(params, key);
    if (!value) continue;
    // The date input gives a day; the api's `to` is exclusive, so ask for "before the next day".
    query.set(key, key === 'to' ? nextDay(value) : value);
  }
  const cursor = param(params, 'cursor');
  if (cursor) query.set('cursor', cursor);

  const [page, clients] = await Promise.all([
    api<LogsPage>(`/admin/logs?${query}`),
    api<Client[]>('/admin/clients'),
  ]);

  const nextHref = page.nextCursor ? withParams(params, { cursor: page.nextCursor }) : null;

  return (
    <div className="space-y-4">
      <Card>
        {/* next/form: a GET form that updates the URL with a client-side navigation. */}
        <Form action="/logs" className="grid grid-cols-2 gap-3 md:grid-cols-7 md:items-end">
          <Field label="Status">
            <select name="status" defaultValue={param(params, 'status')} className={inputClass}>
              <option value="">Any</option>
              {OTP_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Channel">
            <select name="channel" defaultValue={param(params, 'channel')} className={inputClass}>
              <option value="">Any</option>
              {OTP_CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Client">
            <select name="clientId" defaultValue={param(params, 'clientId')} className={inputClass}>
              <option value="">Any</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Recipient (exact)">
            <input
              name="recipient"
              defaultValue={param(params, 'recipient')}
              placeholder="a@b.com"
              className={inputClass}
            />
          </Field>
          <Field label="From">
            <input name="from" type="date" defaultValue={param(params, 'from')} className={inputClass} />
          </Field>
          <Field label="To">
            <input name="to" type="date" defaultValue={param(params, 'to')} className={inputClass} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit">Filter</Button>
            <Link href="/logs" className="self-center text-sm text-zinc-600 hover:underline">
              Clear
            </Link>
          </div>
        </Form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Created</th>
              <th>Client</th>
              <th>Recipient</th>
              <th>Channel</th>
              <th>Purpose</th>
              <th>Status</th>
              <th>Tries</th>
              <th className="px-4">Events</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {page.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No OTP requests match these filters.
                </td>
              </tr>
            )}
            {page.items.map((log) => (
              <tr key={log.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2">{formatDateTime(log.createdAt)}</td>
                <td className="py-2">{log.client.name}</td>
                <td className="py-2 font-mono">{log.recipientMasked}</td>
                <td className="py-2">{log.channel}</td>
                <td className="py-2 text-zinc-500">{log.purpose ?? '—'}</td>
                <td className="py-2">
                  <StatusBadge status={log.status} />
                </td>
                <td className="py-2">{log.attempts}</td>
                <td className="px-4 py-2">
                  <details>
                    <summary className="cursor-pointer text-zinc-600">
                      {log.events.map((e) => e.type).join(' → ')}
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                      {log.events.map((event, i) => (
                        <li key={i}>
                          <span className="font-medium">{event.type}</span>{' '}
                          {formatDateTime(event.createdAt)}
                          {event.detail && (
                            <code className="ml-1 text-zinc-500">{JSON.stringify(event.detail)}</code>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-1 font-mono text-[11px] text-zinc-400">{log.id}</div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex justify-between text-sm">
        {cursor ? (
          <Link href={withParams(params, { cursor: undefined })} className="hover:underline">
            ← First page
          </Link>
        ) : (
          <span />
        )}
        {nextHref && (
          <Link href={nextHref} className="hover:underline">
            Next page →
          </Link>
        )}
      </div>
    </div>
  );
}

function nextDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

function withParams(params: SearchParams, changes: Record<string, string | undefined>): string {
  const next = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = param(params, key);
    if (value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const qs = next.toString();
  return qs ? `/logs?${qs}` : '/logs';
}
