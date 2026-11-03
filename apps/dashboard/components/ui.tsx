import type { OtpStatus } from '@otp/shared';
import type { ComponentProps, ReactNode } from 'react';

/** Small styling helpers shared by the pages (plain Tailwind, no component library). */

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${className}`}
      {...props}
    />
  );
}

const buttonStyles = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-700',
  secondary: 'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export const inputClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-zinc-500 focus:outline-none';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

export function Alert({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  const style =
    kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-green-200 bg-green-50 text-green-800';
  return <p className={`rounded-md border px-3 py-2 text-sm ${style}`}>{children}</p>;
}

const statusStyles: Record<OtpStatus | 'active' | 'revoked', string> = {
  REQUESTED: 'bg-zinc-100 text-zinc-700',
  SENT: 'bg-blue-100 text-blue-800',
  VERIFIED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  LOCKED: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-zinc-200 text-zinc-600',
  active: 'bg-green-100 text-green-800',
  revoked: 'bg-zinc-200 text-zinc-600',
};

export function StatusBadge({ status }: { status: keyof typeof statusStyles }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 animate-pulse rounded bg-zinc-100" />
      ))}
    </Card>
  );
}
