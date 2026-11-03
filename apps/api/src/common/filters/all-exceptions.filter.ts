import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';
import { RateLimitedException } from '../exceptions/rate-limited.exception';

/**
 * One error shape for every endpoint:
 * { statusCode, error, message, ...extra, requestId, path, timestamp }
 * Unknown errors become a 500 without leaking internals; the details go to the log instead.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      message = exception.message;
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const {
          message: bodyMessage,
          error: _error,
          statusCode: _status,
          ...rest
        } = body as Record<string, unknown>;
        if (Array.isArray(bodyMessage)) {
          // ValidationPipe puts one message per invalid field into an array.
          message = 'Validation failed';
          extra.details = bodyMessage;
        } else if (typeof bodyMessage === 'string') {
          message = bodyMessage;
        }
        extra = { ...extra, ...rest };
      }
      if (exception instanceof RateLimitedException) {
        res.setHeader('Retry-After', String(exception.retryAfterSeconds));
      }
    } else {
      this.logger.error(exception);
    }

    res.status(statusCode).json({
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      ...extra,
      requestId: req.id,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
