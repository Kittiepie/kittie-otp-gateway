import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env.validation';
import type { ChannelProvider, DeliveryResult } from './channel-provider';

/** Sends the code over SMTP: Mailpit locally, any SMTP account in production. */
@Injectable()
export class EmailProvider implements ChannelProvider, OnApplicationShutdown {
  readonly channel = 'email' as const;
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly ttlMinutes: number;

  constructor(config: ConfigService<Env, true>) {
    const user = config.get('SMTP_USER', { infer: true });
    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      auth: user ? { user, pass: config.get('SMTP_PASS', { infer: true }) } : undefined,
    });
    this.from = config.get('SMTP_FROM', { infer: true });
    this.ttlMinutes = Math.round(config.get('OTP_TTL_SECONDS', { infer: true }) / 60);
  }

  async send(recipient: string, code: string): Promise<DeliveryResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: recipient,
      subject: `Your verification code: ${code}`,
      text: `Your verification code is ${code}. It expires in ${this.ttlMinutes} minutes.\n\nIf you did not ask for this code, you can ignore this email.`,
      html: `<p>Your verification code is</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in ${this.ttlMinutes} minutes. If you did not ask for this code, you can ignore this email.</p>`,
    });
    return { provider: 'smtp', messageId: info.messageId };
  }

  onApplicationShutdown() {
    this.transporter.close();
  }
}
