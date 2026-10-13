import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public endpoints that do not require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/realtime/groups',
  '/_next',
  '/favicon.ico',
  '/logo.svg'
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip static assets and public endpoints
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get('da3m_session')?.value;
  const authHeader = req.headers.get('authorization');
  const token = sessionCookie || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

  // 2. Protect Super Admin page routes
  if (pathname.startsWith('/admin/users')) {
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 3. Protect backend database write operations (POST, PUT, PATCH, DELETE)
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (pathname.startsWith('/api/') && isWriteMethod) {
    // Exempt /api/groups/sync if it is an internal device broadcast
    if (pathname.startsWith('/api/groups/sync')) {
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.json(
        { error: 'غير مصرح: يجب تسجيل الدخول برتبة مسؤول لإجراء عمليات الكتابة في قاعدة البيانات' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
