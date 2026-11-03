import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ClientRequest } from './api-key.guard';

/** `@CurrentClient() client` — the client that ApiKeyGuard attached to the request. */
export const CurrentClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<ClientRequest>().client,
);
