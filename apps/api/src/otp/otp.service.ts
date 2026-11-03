import {
  BadRequestException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OtpEventType, OtpStatus } from '@otp/shared';
import { randomInt, randomUUID } from 'node:crypto';
import { hmacSha256Hex, safeEqualHex } from '../common/crypto';
import type { Env } from '../config/env.validation';
import type { Client, Prisma } from '../generated/prisma/client';
import { OtpJobPublisher } from '../messaging/otp-job.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { RequestOtpDto, RequestOtpResponseDto } from './dto/request-otp.dto';
import { VerifyOtpDto, VerifyOtpResponseDto } from './dto/verify-otp.dto';
import { OtpStore } from './otp.store';
import { RateLimiterService } from '../redis/rate-limiter.service';
import { isValidRecipient, maskRecipient, normalizeRecipient } from './recipient';

/**
 * Statuses that may still become EXPIRED (by TTL or by a newer OTP). FAILED is left out on
 * purpose: a delivery failure is final and must stay visible in logs and stats.
 */
export const EXPIRABLE_STATUSES: OtpStatus[] = ['REQUESTED', 'SENT'];

const CLIENT_WINDOW_SECONDS = 60;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly hmacSecret: string;
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly recipientLimit: number;
  private readonly recipientWindowSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: OtpStore,
    private readonly rateLimiter: RateLimiterService,
    private readonly publisher: OtpJobPublisher,
    config: ConfigService<Env, true>,
  ) {
    this.hmacSecret = config.get('OTP_HMAC_SECRET', { infer: true });
    this.ttlSeconds = config.get('OTP_TTL_SECONDS', { infer: true });
    this.maxAttempts = config.get('OTP_MAX_ATTEMPTS', { infer: true });
    this.recipientLimit = config.get('RATE_LIMIT_RECIPIENT_MAX', { infer: true });
    this.recipientWindowSeconds = config.get('RATE_LIMIT_RECIPIENT_WINDOW_SECONDS', {
      infer: true,
    });
  }

  /** FR-01, FR-02, FR-06, FR-07: create an OTP and queue it for delivery. */
  async request(client: Client, dto: RequestOtpDto): Promise<RequestOtpResponseDto> {
    const recipient = normalizeRecipient(dto.channel, dto.recipient);
    if (!isValidRecipient(dto.channel, recipient)) {
      throw new BadRequestException(
        `recipient is not a valid ${dto.channel === 'email' ? 'email address' : 'phone number'}`,
      );
    }
    // Keyed hash: lets us find "same recipient" without storing the address itself.
    const recipientHash = hmacSha256Hex(this.hmacSecret, `recipient:${recipient}`);

    await this.rateLimiter.consume(
      `rl:client:${client.id}`,
      client.rateLimitPerMin,
      CLIENT_WINDOW_SECONDS,
      'Client rate limit exceeded',
    );
    await this.rateLimiter.consume(
      `rl:recipient:${recipientHash}`,
      this.recipientLimit,
      this.recipientWindowSeconds,
      'Too many OTP requests for this recipient',
    );

    const requestId = randomUUID();
    // randomInt uses the OS CSPRNG; Math.random() is predictable and must never be used here.
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    // 1. Audit trail first: the request row and its REQUESTED event commit together or not at all.
    await this.prisma.$transaction(async (tx) => {
      await tx.otpRequest.create({
        data: {
          id: requestId,
          clientId: client.id,
          recipientMasked: maskRecipient(dto.channel, recipient),
          recipientHash,
          channel: dto.channel,
          purpose: dto.purpose,
          expiresAt,
        },
      });
      await tx.otpEvent.create({
        data: { requestId, type: 'REQUESTED', detail: { purpose: dto.purpose ?? null } },
      });
    });

    // 2. The code hash goes to Redis with a TTL; any older OTP for this recipient is removed.
    const replacedId = await this.store.save({
      requestId,
      clientId: client.id,
      recipientHash,
      codeHash: this.hashCode(requestId, code),
      ttlSeconds: this.ttlSeconds,
    });
    if (replacedId) {
      await this.transition(
        replacedId,
        { status: 'EXPIRED' },
        { type: 'EXPIRED', detail: { reason: 'replaced', replacedBy: requestId } },
        EXPIRABLE_STATUSES,
      );
    }

    // 3. Hand delivery to the worker. This runs after the DB commit on purpose: the worker must
    //    never see a job for a request that was rolled back.
    try {
      await this.publisher.publish({
        requestId,
        channel: dto.channel,
        recipient,
        code,
        attempt: 1,
      });
    } catch (error) {
      this.logger.error({ err: error, requestId }, 'Failed to queue OTP for delivery');
      await this.store.consume(requestId, client.id, recipientHash);
      await this.transition(
        requestId,
        { status: 'FAILED' },
        { type: 'FAILED', detail: { reason: 'publish_failed' } },
      );
      throw new ServiceUnavailableException('Could not queue the OTP for delivery, try again');
    }

    return { requestId, expiresAt: expiresAt.toISOString() };
  }

  /** FR-04, FR-05: check a code; single use; locks after OTP_MAX_ATTEMPTS wrong tries. */
  async verify(client: Client, dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    const reserved = await this.store.reserveAttempt(dto.requestId, client.id, this.maxAttempts);
    if (reserved.kind === 'missing') return this.handleMissing(client.id, dto.requestId);
    if (reserved.kind === 'locked') throw this.lockedException();

    const { attempts, codeHash, recipientHash } = reserved;
    const matches = safeEqualHex(this.hashCode(dto.requestId, dto.code), codeHash);

    if (matches) {
      // Only the caller that actually deletes the key wins; a racing second call gets 410.
      const consumed = await this.store.consume(dto.requestId, client.id, recipientHash);
      if (!consumed) throw new GoneException('OTP has already been used');
      await this.transition(
        dto.requestId,
        { status: 'VERIFIED', verifiedAt: new Date(), attempts },
        { type: 'VERIFIED', detail: { attempts } },
      );
      return { verified: true };
    }

    if (attempts >= this.maxAttempts) {
      await this.transition(
        dto.requestId,
        { status: 'LOCKED', attempts },
        { type: 'LOCKED', detail: { attempts } },
      );
      throw this.lockedException();
    }

    await this.prisma.otpRequest.update({ where: { id: dto.requestId }, data: { attempts } });
    throw new BadRequestException({
      message: 'Invalid code',
      verified: false,
      attemptsRemaining: this.maxAttempts - attempts,
    });
  }

  /** The Redis key is gone: unknown id (404), already used, or expired (410). */
  private async handleMissing(clientId: string, requestId: string): Promise<never> {
    const row = await this.prisma.otpRequest.findFirst({
      where: { id: requestId, clientId },
      select: { status: true },
    });
    if (!row) throw new NotFoundException('OTP request not found');
    if (row.status === 'VERIFIED') throw new GoneException('OTP has already been used');

    await this.transition(
      requestId,
      { status: 'EXPIRED' },
      { type: 'EXPIRED', detail: { reason: 'ttl' } },
      EXPIRABLE_STATUSES,
    );
    throw new GoneException('OTP has expired');
  }

  /**
   * Updates the request and appends an audit event in one transaction. With `onlyFrom`, the
   * update only happens if the current status is in that list (no overwriting final states).
   */
  private async transition(
    requestId: string,
    data: Prisma.OtpRequestUpdateManyMutationInput & { status: OtpStatus },
    event: { type: OtpEventType; detail: Prisma.InputJsonValue },
    onlyFrom?: OtpStatus[],
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.otpRequest.updateMany({
        where: { id: requestId, ...(onlyFrom && { status: { in: onlyFrom } }) },
        data,
      });
      if (count > 0) {
        await tx.otpEvent.create({ data: { requestId, type: event.type, detail: event.detail } });
      }
      return count > 0;
    });
  }

  /** Binding the hash to the request id means a code can't be replayed against another request. */
  private hashCode(requestId: string, code: string): string {
    return hmacSha256Hex(this.hmacSecret, `otp:${requestId}:${code}`);
  }

  private lockedException() {
    return new HttpException(
      'Too many wrong attempts. Request a new OTP.',
      HttpStatus.LOCKED, // 423
    );
  }
}
