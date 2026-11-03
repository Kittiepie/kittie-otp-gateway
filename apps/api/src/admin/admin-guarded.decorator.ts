import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiResponse } from '@nestjs/swagger';
import { ADMIN_COOKIE } from './auth/admin-session';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

/** Requires an admin session and documents that in Swagger. */
export function AdminGuarded() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiCookieAuth(ADMIN_COOKIE),
    ApiBearerAuth(),
    ApiResponse({ status: 401, description: 'Not logged in' }),
  );
}
