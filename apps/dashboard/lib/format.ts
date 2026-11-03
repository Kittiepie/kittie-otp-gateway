const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'UTC',
});

/** All times are shown in UTC, the same zone the stats are grouped by. */
export function formatDateTime(iso: string | null): string {
  return iso ? `${dateTime.format(new Date(iso))} UTC` : '—';
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
