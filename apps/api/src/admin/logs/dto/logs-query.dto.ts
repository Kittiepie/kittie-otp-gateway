import { OTP_CHANNELS, OTP_STATUSES, type OtpChannel, type OtpStatus } from '@otp/shared';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LogsQueryDto {
  @IsOptional()
  @IsIn(OTP_STATUSES)
  status?: OtpStatus;

  @IsOptional()
  @IsIn(OTP_CHANNELS)
  channel?: OtpChannel;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  /** Exact recipient (email or phone). Matched by its hash; the plain value is never stored. */
  @IsOptional()
  @IsString()
  @MaxLength(254)
  recipient?: string;

  /** Inclusive lower bound on created time, ISO 8601 (e.g. 2026-11-01 or 2026-11-01T08:00:00Z). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Exclusive upper bound on created time, ISO 8601. */
  @IsOptional()
  @IsISO8601()
  to?: string;

  /** `nextCursor` from the previous page. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class OtpEventDto {
  type!: OtpStatus;
  detail!: unknown;
  createdAt!: Date;
}

export class OtpLogDto {
  id!: string;
  client!: { id: string; name: string };
  /** Masked, e.g. a***@gmail.com (NFR-04). */
  recipientMasked!: string;
  channel!: OtpChannel;
  purpose!: string | null;
  status!: OtpStatus;
  attempts!: number;
  createdAt!: Date;
  expiresAt!: Date;
  verifiedAt!: Date | null;
  events!: OtpEventDto[];
}

export class LogsPageDto {
  items!: OtpLogDto[];
  /** Pass as `cursor` to get the next page; null on the last page. */
  nextCursor!: string | null;
}
