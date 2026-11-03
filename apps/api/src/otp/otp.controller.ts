import { Body, Controller, Headers, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentClient } from '../auth/current-client.decorator';
import type { Client } from '../generated/prisma/client';
import { RequestOtpDto, RequestOtpResponseDto } from './dto/request-otp.dto';
import { VerifyOtpDto, VerifyOtpResponseDto } from './dto/verify-otp.dto';
import { IdempotencyService } from './idempotency.service';
import { OtpService } from './otp.service';

@ApiTags('otp')
@ApiSecurity('api-key')
@ApiResponse({ status: 401, description: 'Missing or invalid API key' })
@UseGuards(ApiKeyGuard)
@Controller('v1/otp')
export class OtpController {
  constructor(
    private readonly otp: OtpService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post('request')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiResponse({ status: 202, type: RequestOtpResponseDto })
  @ApiResponse({ status: 429, description: 'Rate limited; see Retry-After' })
  async request(
    @CurrentClient() client: Client,
    @Body() dto: RequestOtpDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RequestOtpResponseDto> {
    const { response, replayed } = await this.idempotency.execute(
      client.id,
      idempotencyKey,
      dto,
      () => this.otp.request(client, dto),
    );
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    return response;
  }

  @Post('verify')
  @HttpCode(200)
  @ApiResponse({ status: 200, type: VerifyOtpResponseDto })
  @ApiResponse({ status: 400, description: 'Wrong code (attemptsRemaining in body)' })
  @ApiResponse({ status: 404, description: 'Unknown requestId' })
  @ApiResponse({ status: 410, description: 'Expired or already used' })
  @ApiResponse({ status: 423, description: 'Locked after too many wrong attempts' })
  verify(
    @CurrentClient() client: Client,
    @Body() dto: VerifyOtpDto,
  ): Promise<VerifyOtpResponseDto> {
    return this.otp.verify(client, dto);
  }
}
