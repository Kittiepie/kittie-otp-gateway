import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, PageHeader, TableSkeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { formatPercent } from '@/lib/format';
import type { Stats } from '@/lib/types';
import { StatsChart } from './stats-chart';

export const metadata: Metadata = { title: 'Overview' };

const RANGES = [7, 14, 30] as const;

export default function OverviewPage({ searchParams }: PageProps<'/'>) {
  return (
    <>
      <PageHeader title="Overview" />
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <StatsSection searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function StatsSection({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const { days: rawDays } = await searchParams;
  const days = RANGES.find((range) => String(range) === rawDays) ?? 14;
  const stats = await api<Stats>(`/admin/stats?days=${days}`);
  const { totals } = stats;

  const cards = [
    { label: 'Requested', value: totals.requested.toLocaleString() },
    { label: 'Verified', value: totals.verified.toLocaleString() },
    { label: 'Success rate', value: formatPercent(totals.successRate) },
    { label: 'Failed to send', value: totals.failed.toLocaleString() },
    { label: 'Locked', value: totals.locked.toLocaleString() },
    { label: 'Expired', value: totals.expired.toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-sm">
        {RANGES.map((range) => (
          <Link
            key={range}
            href={`/?days=${range}`}
            className={`rounded-md px-3 py-1 ${
              range === days
                ? 'bg-zinc-900 text-white'
                : 'bg-white text-zinc-700 ring-1 ring-zinc-200'
            }`}
          >
            Last {range} days
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold">{card.value}</div>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-4 text-sm font-medium text-zinc-600">OTP requests per day (UTC)</h2>
        <StatsChart days={stats.days} />
      </Card>
    </div>
  );
}
