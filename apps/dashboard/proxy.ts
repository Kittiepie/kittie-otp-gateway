import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'otp_session';

/**
 * Optimistic auth check (Next.js 16 "proxy", formerly middleware). It runs before every page
 * request and only looks at the cookie: is there a token, and has it not expired yet?
 * It does NOT verify the signature; the api does that on every call. This just avoids
 * rendering admin pages for someone who is obviously logged out.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && !isExpired(token)) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  const target = request.nextUrl.pathname + request.nextUrl.search;
  if (target !== '/') loginUrl.searchParams.set('next', target);
  const response = NextResponse.redirect(loginUrl);
  if (token) response.cookies.delete(SESSION_COOKIE);
  return response;
}

/** Reads `exp` from the JWT payload (the middle, base64url-encoded part). */
function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export const config = {
  // Everything except the login page, Next.js internals and static files.
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)'],
};
