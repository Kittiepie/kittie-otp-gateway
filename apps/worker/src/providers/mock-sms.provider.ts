import { Injectable, Logger } from '@nestjs/common';
import type { ChannelProvider, DeliveryResult } from './channel-provider';

/** No real SMS provider (SRS constraint): the "SMS" is a log line containing the code. */
@Injectable()
export class MockSmsProvider implements ChannelProvider {
  readonly channel = 'sms' as const;
  private readonly logger = new Logger('MockSms');

  async send(recipient: string, code: string): Promise<DeliveryResult> {
    this.logger.log(`to=${recipient} message="Your verification code is ${code}"`);
    return { provider: 'mock-sms' };
  }
}
