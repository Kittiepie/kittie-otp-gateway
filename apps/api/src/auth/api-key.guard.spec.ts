import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { generateApiKey } from '../common/api-key';
import type { PrismaService } from '../prisma/prisma.service';
import { ApiKeyGuard, type ClientRequest } from './api-key.guard';

const key = generateApiKey();
const activeClient = { id: 'client-1', status: 'active' };

function storedKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    prefix: key.prefix,
    keyHash: key.keyHash,
    revokedAt: null,
    lastUsedAt: null,
    client: activeClient,
    ...overrides,
  };
}

function setup(row: ReturnType<typeof storedKey> | null) {
  const prisma = {
    apiKey: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const guard = new ApiKeyGuard(prisma as unknown as PrismaService);
  const run = (header?: string) => {
    const req = { header: (name: string) => (name === 'x-api-key' ? header : undefined) };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { req: req as unknown as ClientRequest, result: guard.canActivate(ctx) };
  };
  return { prisma, run };
}

describe('ApiKeyGuard', () => {
  it('accepts a valid key and attaches the client', async () => {
    const { run, prisma } = setup(storedKey());
    const { req, result } = run(key.fullKey);

    await expect(result).resolves.toBe(true);
    expect(req.client).toBe(activeClient);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { prefix: key.prefix } }),
    );
    expect(prisma.apiKey.update).toHaveBeenCalled(); // last_used_at was never set
  });

  it('does not write last_used_at again within a minute', async () => {
    const { run, prisma } = setup(storedKey({ lastUsedAt: new Date() }));
    await run(key.fullKey).result;
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });

  it.each([
    ['no header', undefined, storedKey()],
    ['no dot in key', 'garbage', storedKey()],
    ['unknown prefix', key.fullKey, null],
    ['wrong secret', `${key.prefix}.not-the-secret`, storedKey()],
    ['revoked key', key.fullKey, storedKey({ revokedAt: new Date() })],
    ['revoked client', key.fullKey, storedKey({ client: { ...activeClient, status: 'revoked' } })],
  ])('rejects %s with 401', async (_case, header, row) => {
    const { run } = setup(row);
    await expect(run(header).result).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
