import { HttpException, HttpStatus } from '@nestjs/common';

/** 429 that also tells the client when to retry; the exception filter turns it into `Retry-After`. */
export class RateLimitedException extends HttpException {
  constructor(
    public readonly retryAfterSeconds: number,
    message = 'Too many requests',
  ) {
    super({ message, retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
