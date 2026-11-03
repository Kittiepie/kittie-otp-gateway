import { TableSkeleton } from '@/components/ui';

/** Shown instantly on navigation while the page's server components fetch data. */
export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-200" />
      <TableSkeleton rows={6} />
    </div>
  );
}
