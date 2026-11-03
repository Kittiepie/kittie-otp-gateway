import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export class DailyStatsDto {
  /** UTC day, YYYY-MM-DD. */
  day!: string;
  requested!: number;
  verified!: number;
  failed!: number;
  locked!: number;
  expired!: number;
}

export class StatsDto {
  days!: DailyStatsDto[];
  totals!: Omit<DailyStatsDto, 'day'> & {
    /** verified / requested, 0..1. */
    successRate: number;
  };
}

interface Row {
  day: Date;
  requested: bigint;
  verified: bigint;
  failed: bigint;
  locked: bigint;
  expired: bigint;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Requests per day by final status. generate_series produces every day in the range, and the
   * LEFT JOIN keeps days without requests (they show as 0 instead of disappearing from the chart).
   */
  async daily(days: number): Promise<StatsDto> {
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT d.day,
             count(r.id)                                       AS requested,
             count(r.id) FILTER (WHERE r.status = 'VERIFIED') AS verified,
             count(r.id) FILTER (WHERE r.status = 'FAILED')   AS failed,
             count(r.id) FILTER (WHERE r.status = 'LOCKED')   AS locked,
             count(r.id) FILTER (WHERE r.status = 'EXPIRED')  AS expired
      FROM generate_series(
             date_trunc('day', now() AT TIME ZONE 'UTC') - make_interval(days => ${days - 1}),
             date_trunc('day', now() AT TIME ZONE 'UTC'),
             interval '1 day'
           ) AS d(day)
      LEFT JOIN otp_requests r
             ON date_trunc('day', r.created_at AT TIME ZONE 'UTC') = d.day
      GROUP BY d.day
      ORDER BY d.day`;

    // COUNT returns bigint, which arrives as a JS BigInt; JSON can't serialise those.
    const daily = rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      requested: Number(row.requested),
      verified: Number(row.verified),
      failed: Number(row.failed),
      locked: Number(row.locked),
      expired: Number(row.expired),
    }));
    const sum = (key: keyof Omit<DailyStatsDto, 'day'>) =>
      daily.reduce((total, day) => total + day[key], 0);
    const requested = sum('requested');
    const verified = sum('verified');
    return {
      days: daily,
      totals: {
        requested,
        verified,
        failed: sum('failed'),
        locked: sum('locked'),
        expired: sum('expired'),
        successRate: requested === 0 ? 0 : verified / requested,
      },
    };
  }
}
