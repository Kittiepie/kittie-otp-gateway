import type { Request } from 'express';

/** Name of the httpOnly cookie that holds the admin JWT. */
export const ADMIN_COOKIE = 'otp_admin';

export interface AdminJwtPayload {
  sub: string;
  email: string;
}

export interface AdminRequest extends Request {
  admin: AdminJwtPayload;
}
