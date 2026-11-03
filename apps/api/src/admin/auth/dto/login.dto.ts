import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** @example "admin@otp.local" */
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class AdminDto {
  id!: string;
  email!: string;
}

export class LoginResponseDto {
  /** Also set as the httpOnly `otp_admin` cookie. */
  accessToken!: string;
  expiresAt!: string;
  admin!: AdminDto;
}
