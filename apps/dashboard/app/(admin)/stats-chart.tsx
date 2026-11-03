'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyStats } from '@/lib/types';

/** Recharts draws with browser APIs (SVG measuring), so the chart is a Client Component. */
export function StatsChart({ days }: { days: DailyStats[] }) {
  const data = days.map((d) => ({ ...d, label: d.day.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Legend />
        <Bar dataKey="requested" name="Requested" fill="#a1a1aa" />
        <Bar dataKey="verified" name="Verified" fill="#16a34a" />
        <Bar dataKey="failed" name="Failed" fill="#dc2626" />
      </BarChart>
    </ResponsiveContainer>
  );
}
