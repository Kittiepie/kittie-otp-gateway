import { OTP_CHANNELS, type OtpChannel } from '@otp/shared';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  /** Email address or phone number, depending on `channel`. */
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  recipient!: string;

  /** @example "email" */
  @IsIn(OTP_CHANNELS)
  channel!: OtpChannel;

  /** Free text for the audit log, e.g. "login" or "reset-password". */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  purpose?: string;
}

export class RequestOtpResponseDto {
  requestId!: string;
  expiresAt!: string;
}
