import { IsUUID } from 'class-validator';
import { RequestOtpDto } from '../../../otp/dto/request-otp.dto';
import { VerifyOtpDto } from '../../../otp/dto/verify-otp.dto';

/** Same body as the public API, plus which client to act as. */
export class TestRequestDto extends RequestOtpDto {
  @IsUUID()
  clientId!: string;
}

export class TestVerifyDto extends VerifyOtpDto {
  @IsUUID()
  clientId!: string;
}
