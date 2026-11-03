import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AdminRequest } from './admin-session';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AdminRequest>().admin,
);
