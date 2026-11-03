import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OtpStatus } from '@otp/shared';
import { Pool } from 'pg';
import type { Env } from '../config/env.validation';

/**
 * The worker's only DB access: read a request's status and append delivery events.
 * Plain SQL with `pg` instead of Prisma: two small queries don't need an ORM, and the api owns
 * the schema and migrations. Table and enum names match the Prisma schema (@@map).
 */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;

  constructor(config: ConfigService<Env, true>) {
    this.pool = new Pool({ connectionString: config.get('DATABASE_URL', { infer: true }), max: 5 });
  }

  async getStatus(requestId: string): Promise<OtpStatus | null> {
    const result = await this.pool.query<{ status: OtpStatus }>(
      'SELECT status FROM otp_requests WHERE id = $1',
      [requestId],
    );
    return result.rows[0]?.status ?? null;
  }

  /**
   * Appends a SENT event and moves the request to SENT, but only from REQUESTED. If the user
   * already verified (or the OTP expired) in the meantime, the status is left alone.
   * Both writes are one statement, so they commit together.
   */
  async recordSent(requestId: string, detail: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `WITH updated AS (
         UPDATE otp_requests SET status = 'SENT' WHERE id = $1 AND status = 'REQUESTED'
       )
       INSERT INTO otp_events (request_id, type, detail) VALUES ($1, 'SENT', $2)`,
      [requestId, JSON.stringify(detail)],
    );
  }

  /** Appends a FAILED event; the status becomes FAILED only after the last try. */
  async recordFailure(
    requestId: string,
    detail: Record<string, unknown>,
    final: boolean,
  ): Promise<void> {
    await this.pool.query(
      `WITH updated AS (
         UPDATE otp_requests SET status = 'FAILED'
         WHERE id = $1 AND status = 'REQUESTED' AND $3::boolean
       )
       INSERT INTO otp_events (request_id, type, detail) VALUES ($1, 'FAILED', $2)`,
      [requestId, JSON.stringify(detail), final],
    );
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
