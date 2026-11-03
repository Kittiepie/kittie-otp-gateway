import { IsUUID, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsUUID()
  requestId!: string;

  /** @example "123456" */
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

export class VerifyOtpResponseDto {
  verified!: boolean;
}
