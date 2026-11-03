import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ADMIN_COOKIE, type AdminJwtPayload, type AdminRequest } from './admin-session';

/**
 * Protects /admin/*. Accepts the JWT from the httpOnly cookie (browser, Swagger) or from an
 * `Authorization: Bearer` header (the dashboard's server, which calls the api server-to-server).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const cookies = req.cookies as Record<string, string> | undefined;
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    const token = bearer ?? cookies?.[ADMIN_COOKIE];
    if (!token) throw new UnauthorizedException('Not logged in');

    try {
      req.admin = await this.jwt.verifyAsync<AdminJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expired or invalid');
    }
    return true;
  }
}
