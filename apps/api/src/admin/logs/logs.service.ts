import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OTP_CHANNELS } from '@otp/shared';
import { hmacSha256Hex } from '../../common/crypto';
import type { Env } from '../../config/env.validation';
import type { Prisma } from '../../generated/prisma/client';
import { normalizeRecipient } from '../../otp/recipient';
import { PrismaService } from '../../prisma/prisma.service';
import type { LogsPageDto, LogsQueryDto, OtpLogDto } from './dto/logs-query.dto';

const logSelect = {
  id: true,
  client: { select: { id: true, name: true } },
  recipientMasked: true,
  channel: true,
  purpose: true,
  status: true,
  attempts: true,
  createdAt: true,
  expiresAt: true,
  verifiedAt: true,
  events: {
    select: { type: true, detail: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} as const;

interface Cursor {
  createdAt: string;
  id: string;
}

/**
 * Audit log with cursor pagination.
 *
 * Offset pagination (`?page=50`) makes Postgres read and throw away every row before the page,
 * and rows shift when new ones arrive. A cursor remembers the last row seen (created_at, id) and
 * asks for rows "after" it, which uses the index and stays stable while new rows are added.
 * `id` breaks ties between rows with the same timestamp.
 */
@Injectable()
export class LogsService {
  private readonly hmacSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.hmacSecret = config.get('OTP_HMAC_SECRET', { infer: true });
  }

  async list(query: LogsQueryDto): Promise<LogsPageDto> {
    const filters: Prisma.OtpRequestWhereInput[] = [];
    if (query.status) filters.push({ status: query.status });
    if (query.channel) filters.push({ channel: query.channel });
    if (query.clientId) filters.push({ clientId: query.clientId });
    if (query.from) filters.push({ createdAt: { gte: new Date(query.from) } });
    if (query.to) filters.push({ createdAt: { lt: new Date(query.to) } });
    if (query.recipient) {
      filters.push({ recipientHash: { in: this.recipientHashes(query.recipient) } });
    }
    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor);
      const createdAt = new Date(cursor.createdAt);
      filters.push({
        OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }],
      });
    }

    // Ask for one extra row: if it comes back, there is a next page.
    const rows = await this.prisma.otpRequest.findMany({
      where: { AND: filters },
      select: logSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const nextCursor =
      rows.length > query.limit && last
        ? this.encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;
    return { items, nextCursor };
  }

  async get(id: string): Promise<OtpLogDto> {
    const row = await this.prisma.otpRequest.findUnique({ where: { id }, select: logSelect });
    if (!row) throw new NotFoundException('OTP request not found');
    return row;
  }

  /** The admin may not say which channel; hash the value as both an email and a phone. */
  private recipientHashes(raw: string): string[] {
    return OTP_CHANNELS.map((channel) =>
      hmacSha256Hex(this.hmacSecret, `recipient:${normalizeRecipient(channel, raw)}`),
    );
  }

  private encodeCursor(cursor: Cursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private decodeCursor(raw: string): Cursor {
    try {
      const cursor = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
      if (typeof cursor.id === 'string' && !Number.isNaN(Date.parse(cursor.createdAt))) {
        return cursor;
      }
    } catch {
      // fall through
    }
    throw new BadRequestException('Invalid cursor');
  }
}
