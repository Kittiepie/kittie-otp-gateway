import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { apiKeyPrefix, hashApiKey } from '../common/api-key';
import { safeEqualHex } from '../common/crypto';
import type { Client } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ClientRequest extends Request {
  client: Client;
}

/** Only touch `last_used_at` once a minute per key, so every request doesn't cost a DB write. */
const LAST_USED_WRITE_INTERVAL_MS = 60_000;

/**
 * Authenticates client apps by the `x-api-key` header and attaches the client to the request.
 * Guards run after middleware and before interceptors, pipes and the handler.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ClientRequest>();
    const rawKey = req.header('x-api-key');
    if (!rawKey) throw new UnauthorizedException('Missing x-api-key header');

    const prefix = apiKeyPrefix(rawKey);
    const apiKey = prefix
      ? await this.prisma.apiKey.findUnique({ where: { prefix }, include: { client: true } })
      : null;

    const valid =
      apiKey !== null &&
      apiKey.revokedAt === null &&
      apiKey.client.status === 'active' &&
      safeEqualHex(hashApiKey(rawKey), apiKey.keyHash);
    // Same message for every failure, so callers can't tell which part was wrong.
    if (!valid) throw new UnauthorizedException('Invalid API key');

    req.client = apiKey.client;

    const lastUsed = apiKey.lastUsedAt?.getTime() ?? 0;
    if (Date.now() - lastUsed > LAST_USED_WRITE_INTERVAL_MS) {
      // Fire and forget: a failed bookkeeping write must not fail the request.
      void this.prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }
    return true;
  }
}
