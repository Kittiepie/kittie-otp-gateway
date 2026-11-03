import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { generateApiKey } from '../../common/api-key';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ApiKeyDto,
  ClientDto,
  CreateClientDto,
  CreatedClientDto,
  CreatedKeyDto,
  UpdateClientDto,
} from './dto/client.dto';

/** Columns safe to return. `keyHash` is never selected. */
const keySelect = {
  id: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

const clientSelect = {
  id: true,
  name: true,
  status: true,
  rateLimitPerMin: true,
  createdAt: true,
  apiKeys: { select: keySelect, orderBy: { createdAt: 'desc' } },
} as const;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<ClientDto[]> {
    return this.prisma.client.findMany({ select: clientSelect, orderBy: { createdAt: 'desc' } });
  }

  async get(id: string): Promise<ClientDto> {
    const client = await this.prisma.client.findUnique({ where: { id }, select: clientSelect });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  /** Creates the client with its first key. The full key is in the response and nowhere else. */
  async create(dto: CreateClientDto): Promise<CreatedClientDto> {
    const key = generateApiKey();
    const client = await this.prisma.client.create({
      data: {
        name: dto.name,
        rateLimitPerMin: dto.rateLimitPerMin,
        apiKeys: { create: { prefix: key.prefix, keyHash: key.keyHash } },
      },
      select: clientSelect,
    });
    return { client, apiKey: key.fullKey, key: client.apiKeys[0] };
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientDto> {
    await this.get(id);
    return this.prisma.client.update({ where: { id }, data: dto, select: clientSelect });
  }

  /** Revoking a client also revokes all its keys; rows stay for the audit log. */
  async revoke(id: string): Promise<ClientDto> {
    await this.get(id);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.apiKey.updateMany({
        where: { clientId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      return tx.client.update({ where: { id }, data: { status: 'revoked' }, select: clientSelect });
    });
  }

  async createKey(clientId: string): Promise<CreatedKeyDto> {
    const client = await this.get(clientId);
    if (client.status !== 'active') throw new ConflictException('Client is revoked');
    const key = generateApiKey();
    const created = await this.prisma.apiKey.create({
      data: { clientId, prefix: key.prefix, keyHash: key.keyHash },
      select: keySelect,
    });
    return { apiKey: key.fullKey, key: created };
  }

  async revokeKey(clientId: string, keyId: string): Promise<ApiKeyDto> {
    const key = await this.prisma.apiKey.findFirst({ where: { id: keyId, clientId } });
    if (!key) throw new NotFoundException('API key not found');
    return this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: key.revokedAt ?? new Date() },
      select: keySelect,
    });
  }
}
