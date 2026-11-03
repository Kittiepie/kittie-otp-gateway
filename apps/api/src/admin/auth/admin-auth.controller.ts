import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../../config/env.validation';
import { AdminAuthService } from './admin-auth.service';
import { ADMIN_COOKIE, type AdminJwtPayload } from './admin-session';
import { CurrentAdmin } from './current-admin.decorator';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('admin: auth')
@Controller('admin/auth')
export class AdminAuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AdminAuthService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieOptions = {
      // httpOnly: page JavaScript can't read it, so an XSS bug can't steal the session.
      httpOnly: true,
      // lax: not sent on cross-site POSTs, which blocks most CSRF.
      sameSite: 'lax',
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      path: '/',
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.auth.login(dto.email, dto.password);
    res.cookie(ADMIN_COOKIE, result.accessToken, {
      ...this.cookieOptions,
      maxAge: this.auth.sessionSeconds * 1000,
    });
    return result;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(ADMIN_COOKIE, this.cookieOptions);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth(ADMIN_COOKIE)
  @ApiBearerAuth()
  me(@CurrentAdmin() admin: AdminJwtPayload) {
    return { id: admin.sub, email: admin.email };
  }
}
