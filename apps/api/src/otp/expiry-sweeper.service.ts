import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Redis forgets expired OTPs by itself, but Postgres would keep showing them as SENT.
 * Once a minute this marks them EXPIRED and writes the audit event, in one SQL statement.
 *
 * Safe with several api replicas: UPDATE locks each row, and a second replica re-checks the
 * WHERE clause after the lock is released, finds status = EXPIRED, and skips the row.
 */
@Injectable()
export class ExpirySweeper {
  private readonly logger = new Logger(ExpirySweeper.name);

  constructor(private readonly prisma: PrismaService) {}

  @Interval(60_000)
  async sweep(): Promise<void> {
    try {
      const expired = await this.prisma.$executeRaw`
        WITH expired AS (
          UPDATE otp_requests
          SET status = 'EXPIRED'
          WHERE status IN ('REQUESTED', 'SENT', 'FAILED') AND expires_at < now()
          RETURNING id
        )
        INSERT INTO otp_events (request_id, type, detail)
        SELECT id, 'EXPIRED', '{"reason":"ttl"}'::jsonb FROM expired`;
      if (expired > 0) this.logger.log(`Marked ${expired} OTP request(s) as expired`);
    } catch (error) {
      this.logger.error({ err: error }, 'Expiry sweep failed');
    }
  }
}
