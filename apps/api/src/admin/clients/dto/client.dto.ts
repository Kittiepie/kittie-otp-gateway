import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateClientDto {
  /** @example "Shop backend" */
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  /** OTP requests this client may make per minute. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  rateLimitPerMin?: number;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  rateLimitPerMin?: number;
}

export class ApiKeyDto {
  id!: string;
  prefix!: string;
  createdAt!: Date;
  lastUsedAt!: Date | null;
  revokedAt!: Date | null;
}

export class ClientDto {
  id!: string;
  name!: string;
  status!: 'active' | 'revoked';
  rateLimitPerMin!: number;
  createdAt!: Date;
  apiKeys!: ApiKeyDto[];
}

export class CreatedKeyDto {
  /** The full key. Returned only this once; only its hash is stored. */
  apiKey!: string;
  key!: ApiKeyDto;
}

export class CreatedClientDto extends CreatedKeyDto {
  client!: ClientDto;
}
