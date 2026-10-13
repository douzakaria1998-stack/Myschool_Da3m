import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/userStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get('da3m_session')?.value;
    const authHeader = req.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const token = sessionCookie || headerToken;
    if (!token) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    const sessionRes = await validateSession(token);
    if (!sessionRes) {
      const response = NextResponse.json({ authenticated: false, user: null }, { status: 200 });
      response.cookies.delete('da3m_session');
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: sessionRes.user
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, user: null, error: err?.message }, { status: 500 });
  }
}
