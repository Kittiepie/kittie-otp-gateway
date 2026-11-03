import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { sha256Hex } from '../../common/crypto';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { RateLimiterService } from '../../redis/rate-limiter.service';
import type { AdminJwtPayload } from './admin-session';
import type { LoginResponseDto } from './dto/login.dto';

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly expiresInSeconds: number;
  /** Checked when the email is unknown, so both cases take the same time to fail. */
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rateLimiter: RateLimiterService,
    config: ConfigService<Env, true>,
  ) {
    this.expiresInSeconds = config.get('JWT_EXPIRES_IN_SECONDS', { infer: true });
  }

  async onModuleInit() {
    this.dummyHash = await hash('not-a-real-password');
  }

  get sessionSeconds(): number {
    return this.expiresInSeconds;
  }

  async login(emailInput: string, password: string): Promise<LoginResponseDto> {
    const email = emailInput.trim().toLowerCase();
    // Slows down password guessing for one account: 10 tries per 15 minutes.
    await this.rateLimiter.consume(
      `rl:login:${sha256Hex(email)}`,
      LOGIN_LIMIT,
      LOGIN_WINDOW_SECONDS,
      'Too many login attempts, try again later',
    );

    const admin = await this.prisma.admin.findUnique({ where: { email } });
    // argon2 is deliberately slow and memory-hard, which makes offline cracking of a leaked
    // hash expensive. That's why passwords use it and API keys (random, long) use SHA-256.
    const passwordOk = await verify(admin?.passwordHash ?? this.dummyHash, password);
    if (!admin || !passwordOk) throw new UnauthorizedException('Invalid email or password');

    const payload: AdminJwtPayload = { sub: admin.id, email: admin.email };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      expiresAt: new Date(Date.now() + this.expiresInSeconds * 1000).toISOString(),
      admin: { id: admin.id, email: admin.email },
    };
  }
}
