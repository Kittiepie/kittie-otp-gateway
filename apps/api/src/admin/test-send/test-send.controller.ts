import { Body, ConflictException, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequestOtpResponseDto } from '../../otp/dto/request-otp.dto';
import { VerifyOtpResponseDto } from '../../otp/dto/verify-otp.dto';
import { OtpService } from '../../otp/otp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminGuarded } from '../admin-guarded.decorator';
import { TestRequestDto, TestVerifyDto } from './dto/test-send.dto';

/**
 * FR-13: lets an admin try the real OTP flow from the dashboard without copying an API key.
 * It calls the same OtpService as the public API, so rate limits and audit events apply.
 */
@ApiTags('admin: test-send')
@AdminGuarded()
@Controller('admin/test')
export class TestSendController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
  ) {}

  @Post('request')
  @HttpCode(202)
  async request(@Body() dto: TestRequestDto): Promise<RequestOtpResponseDto> {
    const { clientId, ...body } = dto;
    return this.otp.request(await this.activeClient(clientId), body);
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Body() dto: TestVerifyDto): Promise<VerifyOtpResponseDto> {
    const { clientId, ...body } = dto;
    return this.otp.verify(await this.activeClient(clientId), body);
  }

  private async activeClient(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client || client.status !== 'active') {
      throw new ConflictException('Client not found or revoked');
    }
    return client;
  }
}
